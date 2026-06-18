import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(url && anonKey);

const appRole = import.meta.env.VITE_APP_ROLE || "demo";
const authStorageKey =
  appRole === "admin" ? "artlog-auth-admin" : appRole === "parent" ? "artlog-auth-parent" : "artlog-auth";

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: authStorageKey,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase가 설정되지 않았습니다. .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 추가하세요."
    );
  }
  return supabase;
}
