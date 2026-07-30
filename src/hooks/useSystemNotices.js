import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { queryKeys } from "./queryKeys.js";

function mapSystemNotice(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    important: row.important ?? false,
    date: row.posted_at?.slice(0, 10) ?? "",
    postedAt: row.posted_at,
  };
}

export function useSystemNotices() {
  return useQuery({
    queryKey: queryKeys.systemNotices,
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("system_notices")
        .select("*")
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapSystemNotice);
    },
  });
}

export function useSystemNoticeMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.systemNotices });

  const addNotice = useMutation({
    mutationFn: async ({ title, content, important }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("system_notices")
        .insert({ title, content, important: important ?? false })
        .select()
        .single();
      if (error) throw error;
      return mapSystemNotice(data);
    },
    onSuccess: invalidate,
  });

  const updateNotice = useMutation({
    mutationFn: async ({ id, title, content, important }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("system_notices")
        .update({ title, content, important })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapSystemNotice(data);
    },
    onSuccess: invalidate,
  });

  const deleteNotice = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("system_notices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addNotice, updateNotice, deleteNotice };
}
