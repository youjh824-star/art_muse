import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapInvite } from "../lib/mappers.js";
import { queryKeys } from "./queryKeys.js";

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `ARTM-${s}`;
}

export function useInvites(academyId) {
  return useQuery({
    queryKey: queryKeys.invites(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("invites")
        .select("*, students(name, art_emoji)")
        .eq("academy_id", academyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapInvite);
    },
    enabled: !!academyId,
  });
}

export function useInviteMutations(academyId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.invites(academyId) });

  const createInvite = useMutation({
    mutationFn: async ({ studentId, studentName, studentArt }) => {
      const sb = requireSupabase();
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const { data, error } = await sb
        .from("invites")
        .insert({
          academy_id: academyId,
          code: randomCode(),
          student_id: studentId,
          expires_at: expires.toISOString(),
          used: false,
        })
        .select("*, students(name, art_emoji)")
        .single();
      if (error) throw error;
      const mapped = mapInvite(data);
      return { ...mapped, studentName: studentName ?? mapped.studentName, studentArt: studentArt ?? mapped.studentArt };
    },
    onSuccess: invalidate,
  });

  return { createInvite };
}

export async function peekInvite(code) {
  const sb = requireSupabase();
  const { data, error } = await sb.rpc("peek_invite", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data;
}
