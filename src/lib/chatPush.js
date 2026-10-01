import { requireSupabase } from "./supabase.js";

/** 채팅 메시지 푸시 — 서버에서 push_token 조회 (RLS 우회) */
export async function sendChatPush({ academyId, studentId, target, title, body, data }) {
  if (!academyId || !studentId || !target) {
    throw new Error("chat push 필수값이 누락되었습니다.");
  }

  const sb = requireSupabase();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error("Supabase 환경변수가 누락되었습니다.");
  }

  const {
    data: { session },
  } = await sb.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("로그인 세션이 없어 채팅 푸시를 전송할 수 없습니다.");
  }

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
