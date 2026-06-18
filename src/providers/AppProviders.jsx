import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient.js";
import { isSupabaseConfigured } from "../lib/supabase.js";

const C = {
  cream: "#FAF7F2",
  warm: "#8C7B72",
  terra: "#C17F5B",
  charcoal: "#3D3530",
};

export function SupabaseSetupGate({ children }) {
  if (isSupabaseConfigured) return children;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: C.cream, padding: 24, fontFamily: "-apple-system,'Apple SD Gothic Neo',sans-serif",
    }}>
      <div style={{ maxWidth: 420, background: "white", borderRadius: 16, padding: 28, boxShadow: "0 8px 32px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.charcoal, marginBottom: 12 }}>Supabase 설정 필요</div>
        <p style={{ fontSize: 14, color: C.warm, lineHeight: 1.7, marginBottom: 16 }}>
          프로덕션 모드에서는 Mock 데이터 대신 Supabase를 사용합니다.
          프로젝트 루트 <code>.env</code>에 아래 값을 추가하고 <code>supabase/schema.sql</code>을 실행하세요.
        </p>
        <pre style={{ fontSize: 12, background: C.cream, padding: 12, borderRadius: 8, overflow: "auto" }}>
{`VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
        <p style={{ fontSize: 12, color: C.warm, marginTop: 12 }}>
          자세한 내용: <strong>SUPABASE_SETUP.md</strong>
        </p>
      </div>
    </div>
  );
}

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseSetupGate>{children}</SupabaseSetupGate>
    </QueryClientProvider>
  );
}
