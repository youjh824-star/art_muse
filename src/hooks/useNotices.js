import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapNotice } from "../lib/mappers.js";
import { queryKeys } from "./queryKeys.js";

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
    onSuccess: invalidate,
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
