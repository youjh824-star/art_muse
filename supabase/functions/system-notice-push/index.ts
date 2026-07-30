import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing Authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "supabase env missing" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // 시스템 공지 푸시는 관리자만 발송 가능
    const { data: myProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (myProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const payload = await req.json().catch(() => ({}));
    const title = String(payload?.title ?? "").trim();
    const content = String(payload?.content ?? "").trim();
    const important = Boolean(payload?.important);
    if (!title) {
      return new Response(JSON.stringify({ error: "title is required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const tokens = new Set<string>();

    // 학부모 앱 토큰 (기존 공지/출결 푸시와 동일 소스)
    const { data: parentRows } = await adminClient
      .from("parent_student_links")
      .select("push_token")
      .not("push_token", "is", null);
    for (const row of parentRows ?? []) {
      if (row?.push_token) tokens.add(String(row.push_token));
    }

    // 원장 앱 토큰 (profile에 저장)
    const { data: adminRows } = await adminClient
      .from("profiles")
      .select("push_token")
      .eq("role", "admin")
      .not("push_token", "is", null);
    for (const row of adminRows ?? []) {
      if (row?.push_token) tokens.add(String(row.push_token));
    }

    const validTokens = [...tokens].filter((t) => t.startsWith("ExponentPushToken["));
    if (!validTokens.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), {
        headers: corsHeaders,
      });
    }

    const messages = validTokens.map((to) => ({
      to,
      title: important ? `📢 업데이트 공지: ${title}` : "📢 앱 업데이트 안내",
      body: content || title,
      sound: "default",
      priority: "high",
      data: {
        type: "system_notice",
        important,
      },
    }));

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const expoResult = await expoRes.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        sent: messages.length,
        tokenCount: validTokens.length,
        result: expoResult,
      }),
      { headers: corsHeaders }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
