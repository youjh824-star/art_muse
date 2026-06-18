/**
 * OpenAI 피드백 생성 — APK에 API 키를 넣지 않고 Supabase Edge Function 경유
 *
 * Edge Function 배포:
 *   supabase functions deploy openai-proxy --no-verify-jwt
 *
 * API 키 등록:
 *   supabase secrets set OPENAI_API_KEY=sk-...
 */
import Constants from "expo-constants";

function getConfigExtra() {
  return (
    Constants.expoConfig?.extra ??
    Constants.manifest2?.extra ??
    Constants.manifest?.extra ??
    {}
  );
}

function resolveProxyUrl() {
  const extra = getConfigExtra();
  // supabase functions URL: https://<project-ref>.supabase.co/functions/v1/openai-proxy
  const supabaseUrl =
    extra.supabaseUrl ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    "";
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/openai-proxy`;
}

function resolveModel() {
  const extra = getConfigExtra();
  return (
    extra.openaiModel ||
    process.env.EXPO_PUBLIC_OPENAI_MODEL ||
    "gpt-4o-mini"
  );
}

export async function generateParentFeedback(prompt) {
  const proxyUrl = resolveProxyUrl();
  if (!proxyUrl) {
    throw new Error(
      "Supabase URL이 설정되지 않았습니다. mobile/.env에 EXPO_PUBLIC_SUPABASE_URL을 추가하세요."
    );
  }

  const model = resolveModel();

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `피드백 생성 오류 (${res.status})`);
  }

  const text = data?.text;
  if (!text) throw new Error("피드백 응답이 비어 있습니다.");
  return text;
}
