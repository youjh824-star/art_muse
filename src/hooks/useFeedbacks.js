import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapFeedback } from "../lib/mappers.js";
import { queryKeys } from "./queryKeys.js";

export function useFeedbacks(academyId, { refetchInterval = false } = {}) {
  return useQuery({
    queryKey: queryKeys.feedbacks(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("feedbacks")
        .select("*, students(name)")
        .eq("academy_id", academyId)
        .order("feedback_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapFeedback);
    },
    enabled: !!academyId,
    refetchInterval,
  });
}

export function useFeedbackMutations(academyId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.feedbacks(academyId) });

  const addFeedback = useMutation({
    mutationFn: async (fb) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("feedbacks")
        .insert({
          academy_id: academyId,
          student_id: fb.studentId,
          student_name: fb.studentName,
          content: fb.content,
          feedback_date: fb.date ?? new Date().toISOString().slice(0, 10),
          is_read: false,
          artwork_title: fb.artwork ?? "",
          art_emoji: fb.artEmoji ?? "🎨",
          notify_scheduled_at: fb.notifyScheduledAt ?? null,
          notify_sent: fb.notifyScheduledAt ? false : true,
        })
        .select("*, students(name)")
        .single();
      if (error) throw error;
      return mapFeedback(data);
    },
    onSuccess: invalidate,
  });

  const updateFeedback = useMutation({
    mutationFn: async ({ id, patch }) => {
      const sb = requireSupabase();
      const row = {};
      if (patch.content !== undefined) row.content = patch.content;
      if (patch.read !== undefined) row.is_read = patch.read;
      const { data, error } = await sb.from("feedbacks").update(row).eq("id", id).select("*, students(name)").single();
      if (error) throw error;
      return mapFeedback(data);
    },
    onSuccess: invalidate,
  });

  const deleteFeedback = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("feedbacks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: async (ids) => {
      const sb = requireSupabase();
      const { error } = await sb.from("feedbacks").update({ is_read: true }).in("id", ids);
      if (error) throw error;
    },
    onMutate: async (ids) => {
      const key = queryKeys.feedbacks(academyId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old) =>
        (old ?? []).map((f) => (ids.includes(f.id) ? { ...f, read: true } : f))
      );
      return { prev };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.feedbacks(academyId), ctx.prev);
    },
    onSettled: invalidate,
  });

  const markNotifySent = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("feedbacks").update({ notify_sent: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addFeedback, updateFeedback, deleteFeedback, markRead, markNotifySent };
}
