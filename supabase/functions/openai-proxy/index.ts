/**
 * Supabase Edge Function: openai-proxy
 * APK 소스에 OpenAI API 키를 노출하지 않고 서버에서 안전하게 호출합니다.
 *
 * 배포: supabase functions deploy openai-proxy --no-verify-jwt
 * 환경변수: supabase secrets set OPENAI_API_KEY=sk-...
 */

const ALLOWED_ORIGINS = [
  "https://admin.artmuse.kr",
  "https://parent.artmuse.kr",
  "https://art-muse.vercel.app",
];

const AI_FEEDBACK_SYSTEM =
  "당신은 실제 미술학원을 운영하며 학부모 상담과 학생 작품 피드백을 자주 작성하는 미술 선생님입니다. AI가 쓴 것처럼 보이면 안 됩니다. 실제 수업 직후 학부모에게 보내는 담백하고 자연스러운 피드백만 작성하세요.";

function corsHeaders(origin: string | null) {
  // file:// (APK)는 origin이 null로 옴 → 허용
  const allowed =
    origin === null || ALLOWED_ORIGINS.includes(origin)
      ? (origin ?? "*")
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OpenAI API 키가 서버에 설정되지 않았습니다." }),
      {
        status: 500,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      }
    );
  }

  let body: { prompt?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const { prompt, model = "gpt-4o-mini" } = body;
  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "prompt가 필요합니다." }), {
      status: 400,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: AI_FEEDBACK_SYSTEM },
        { role: "user", content: prompt },
      ],
      max_tokens: 1500,
    }),
  });

  const data = await openaiRes.json().catch(() => ({}));
  if (!openaiRes.ok) {
    return new Response(
      JSON.stringify({
        error: data?.error?.message ?? `OpenAI API 오류 (${openaiRes.status})`,
      }),
      {
        status: openaiRes.status,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      }
    );
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return new Response(
      JSON.stringify({ error: "OpenAI 응답이 비어 있습니다." }),
      {
        status: 502,
        headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
