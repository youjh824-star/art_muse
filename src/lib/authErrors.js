/** Supabase Auth 오류 → 사용자용 한국어 메시지 */
export function authErrorMessage(err) {
  const msg = (err?.message ?? String(err ?? "")).toLowerCase();

  if (msg.includes("rate limit") || msg.includes("email rate limit")) {
    return "이메일 발송 한도를 초과했습니다. Supabase에서 ‘이메일 확인’을 끄거나, 1시간 후 다시 시도·다른 이메일을 사용해 주세요.";
  }
  if (msg.includes("already registered") || msg.includes("already been registered")) {
    return "이미 가입된 이메일입니다. ‘로그인’으로 전환해 주세요.";
  }
  if (msg.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (msg.includes("password") && msg.includes("least")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (msg.includes("email not confirmed")) {
    return "이메일 인증이 필요합니다. 메일함(스팸 포함)을 확인해 주세요.";
  }
  if (msg.includes("signup is disabled")) {
    return "현재 회원가입이 비활성화되어 있습니다. Supabase Auth 설정을 확인해 주세요.";
  }

  return err?.message ?? "로그인에 실패했습니다.";
}

/** Supabase DB / RLS 오류 → 사용자용 한국어 메시지 */
export function dbErrorMessage(err) {
  const msg = (err?.message ?? String(err ?? "")).toLowerCase();

  if (msg.includes("row-level security") || msg.includes("rls")) {
    return "저장 권한이 없습니다. 원장 앱(localhost:5174)에서 로그인했는지 확인해 주세요.";
  }
  if (msg.includes("academy_id") && msg.includes("not-null")) {
    return "학원 정보가 설정되지 않았습니다. 로그아웃 후 다시 로그인해 주세요.";
  }

  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed")) {
    return "네트워크 연결을 확인해 주세요. 인터넷이 연결되어 있는지 확인 후 다시 시도해 주세요.";
  }

  return err?.message ?? "저장에 실패했습니다.";
}
