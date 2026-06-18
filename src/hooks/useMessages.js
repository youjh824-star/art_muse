import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";

export function useLatestMessagesByStudent(academyId) {
  return useQuery({
    queryKey: ["messages_latest", academyId],
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("messages")
        .select("*")
        .eq("academy_id", academyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = {};
      for (const m of (data ?? [])) {
        if (!map[m.student_id]) map[m.student_id] = m;
      }
      return map;
    },
    enabled: !!academyId,
    refetchInterval: 6000,
  });
}

export function useUnreadCountByStudent(academyId) {
  return useQuery({
    queryKey: ["messages_unread", academyId],
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("messages")
        .select("student_id")
        .eq("academy_id", academyId)
        .eq("sender_role", "parent")
        .eq("is_read", false);
      if (error) throw error;
      const counts = {};
      for (const m of (data ?? [])) {
        counts[m.student_id] = (counts[m.student_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!academyId,
    refetchInterval: 6000,
  });
}

const key = (academyId, studentId) => ["messages", academyId, studentId];

export function useMessages(academyId, studentId, { refetchInterval = false } = {}) {
  return useQuery({
    queryKey: key(academyId, studentId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("messages")
        .select("*")
        .eq("academy_id", academyId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!academyId && !!studentId,
    refetchInterval,
  });
}

export function useMessageMutations(academyId, studentId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: key(academyId, studentId) });

  const sendMessage = useMutation({
    mutationFn: async ({ senderId, senderRole, content }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("messages")
        .insert({ academy_id: academyId, student_id: studentId, sender_id: senderId, sender_role: senderRole, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: async (readerRole) => {
      const sb = requireSupabase();
      const senderRole = readerRole === "admin" ? "parent" : "admin";
      await sb
        .from("messages")
        .update({ is_read: true })
        .eq("academy_id", academyId)
        .eq("student_id", studentId)
        .eq("sender_role", senderRole)
        .eq("is_read", false);
    },
    onSuccess: invalidate,
  });

  return { sendMessage, markRead };
}
