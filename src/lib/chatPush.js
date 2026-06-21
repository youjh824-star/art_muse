import { requireSupabase } from "./supabase.js";

/** 채팅 메시지 푸시 — 서버에서 push_token 조회 (RLS 우회) */
export async function sendChatPush({ academyId, studentId, target, title, body, data }) {
  if (!academyId || !studentId || !target) return { sent: 0, reason: "missing_fields" };

  const sb = requireSupabase();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return { sent: 0, reason: "missing_env" };

  const {
    data: { session },
  } = await sb.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return { sent: 0, reason: "no_session" };

  const payload = {
    academyId,
    studentId,
    target,
    title,
    body: body ?? "",
    data: data ?? { type: "message" },
  };

  const res = await fetch(`${baseUrl}/functions/v1/chat-push-notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result?.error || `chat-push-notify HTTP ${res.status}`);
  }

  if (import.meta.env.DEV) {
    console.log("[ArtLog] chat-push-notify", result);
  }
  return result ?? { sent: 0 };
}
