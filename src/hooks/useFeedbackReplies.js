import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";

const key = (feedbackId) => ["feedback_replies", feedbackId];

export function useFeedbackReplies(feedbackId) {
  return useQuery({
    queryKey: key(feedbackId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("feedback_replies")
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!feedbackId,
    refetchInterval: 10000,
  });
}

export function useFeedbackReplyMutation(academyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ feedbackId, senderId, senderRole, content }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("feedback_replies")
        .insert({ feedback_id: feedbackId, academy_id: academyId, sender_id: senderId, sender_role: senderRole, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: key(data.feedback_id) });
    },
  });
}
