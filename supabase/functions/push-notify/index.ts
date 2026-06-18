import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tokens, title, body, data } = await req.json();
    if (!tokens?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    const messages = tokens
      .filter((t: string) => t?.startsWith("ExponentPushToken["))
      .map((token: string) => ({ to: token, title, body, data: data ?? {}, sound: "default", priority: "high" }));

    if (!messages.length) return new Response(JSON.stringify({ sent: 0 }), { headers: corsHeaders });

    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    return new Response(JSON.stringify({ sent: messages.length, result }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
