import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapNotice } from "../lib/mappers.js";
import { queryKeys } from "./queryKeys.js";

const _PUSH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notify`;
const _PUSH_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sendNoticePush({ academyId, title, important }) {
  try {
    const sb = requireSupabase();
    const { data: rows } = await sb
      .from("parent_student_links")
      .select("push_token")
      .eq("academy_id", academyId)
      .not("push_token", "is", null);
    const tokens = [...new Set((rows ?? []).map(r => r.push_token).filter(Boolean))];
    if (!tokens.length) return;
    await fetch(_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${_PUSH_KEY}` },
      body: JSON.stringify({
        tokens,
        title: important ? `📢 중요 공지: ${title}` : "📢 새 공지사항",
        body: important ? "중요 공지가 등록되었습니다. 확인해 주세요." : title,
        data: { type: "notice" },
      }),
    });
  } catch { /* silent */ }
}

export function useNotices(academyId, { refetchInterval = false } = {}) {
  return useQuery({
    queryKey: queryKeys.notices(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("notices")
        .select("*")
        .eq("academy_id", academyId)
        .order("notice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapNotice);
    },
    enabled: !!academyId,
    refetchInterval,
  });
}

export function useNoticeMutations(academyId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.notices(academyId) });

  const addNotice = useMutation({
    mutationFn: async (n) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("notices")
        .insert({
          academy_id: academyId,
          title: n.title,
          content: n.content,
          notice_date: n.date ?? new Date().toISOString().slice(0, 10),
          important: n.important ?? false,
          notice_scope: n.scope ?? "general",
          student_id: n.studentId ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapNotice(data);
    },
    onSuccess: (notice) => {
      invalidate();
      sendNoticePush({ academyId, title: notice.title, important: notice.important });
    },
  });

  const updateNotice = useMutation({
    mutationFn: async ({ id, patch }) => {
      const sb = requireSupabase();
      const row = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.content !== undefined) row.content = patch.content;
      if (patch.important !== undefined) row.important = patch.important;
      const { data, error } = await sb.from("notices").update(row).eq("id", id).select().single();
      if (error) throw error;
      return mapNotice(data);
    },
    onSuccess: invalidate,
  });

  const deleteNotice = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addNotice, updateNotice, deleteNotice };
}
