import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchAdminPushTokens(admin: ReturnType<typeof createClient>, academyId: string) {
  const tokens = new Set<string>();

  const { data: admins } = await admin
    .from("profiles")
    .select("push_token")
    .eq("academy_id", academyId)
    .eq("role", "admin")
    .not("push_token", "is", null);

  for (const row of admins ?? []) {
    if (row.push_token) tokens.add(row.push_token);
  }

  const { data: academy } = await admin
    .from("academies")
    .select("owner_id")
    .eq("id", academyId)
    .maybeSingle();

  if (academy?.owner_id) {
    const { data: ownerProf } = await admin
      .from("profiles")
      .select("push_token")
      .eq("id", academy.owner_id)
      .maybeSingle();
    if (ownerProf?.push_token) tokens.add(ownerProf.push_token);
  }

  return [...tokens];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("[chat-push-notify] request", req.method);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.log("[chat-push-notify] missing auth");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      console.log("[chat-push-notify] auth failed", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { academyId, studentId, target, title, body, data } = await req.json();
    console.log("[chat-push-notify]", { userId: user.id, academyId, studentId, target });

    if (!academyId || !studentId || !target || !title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const studentKey = String(studentId);

    if (target === "admin") {
      const { data: link } = await admin
        .from("parent_student_links")
        .select("id")
        .eq("academy_id", academyId)
        .eq("student_id", studentKey)
        .eq("parent_user_id", user.id)
        .maybeSingle();
      if (!link) {
        console.log("[chat-push-notify] forbidden parent", user.id);
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (target === "parents") {
      const { data: profile } = await admin
        .from("profiles")
        .select("role, academy_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role !== "admin" || profile?.academy_id !== academyId) {
        console.log("[chat-push-notify] forbidden admin", user.id);
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid target" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let tokens: string[] = [];
    if (target === "admin") {
      tokens = await fetchAdminPushTokens(admin, academyId);
    } else {
      const { data: rows } = await admin
        .from("parent_student_links")
        .select("push_token")
        .eq("academy_id", academyId)
        .eq("student_id", studentKey)
        .not("push_token", "is", null);
      tokens = [...new Set((rows ?? []).map((r) => r.push_token).filter(Boolean))];
    }

    console.log("[chat-push-notify] tokens", tokens.length);

    const messages = tokens
      .filter((t: string) => t?.startsWith("ExponentPushToken["))
      .map((token: string) => ({
        to: token,
        title,
        body: body ?? "",
        data: data ?? { type: "message" },
        sound: "default",
        priority: "high",
        channelId: "default",
      }));

    if (!messages.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens", tokenCount: tokens.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    console.log("[chat-push-notify] expo result", JSON.stringify(result).slice(0, 500));

    return new Response(JSON.stringify({ sent: messages.length, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[chat-push-notify] error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
