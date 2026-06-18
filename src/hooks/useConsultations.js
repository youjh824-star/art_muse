import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";

function mapConsultation(row) {
  return {
    id: row.id,
    academyId: row.academy_id,
    studentId: row.student_id,
    consultDate: row.consult_date,
    content: row.content,
    createdAt: row.created_at,
  };
}

export function useConsultations(academyId, studentId) {
  return useQuery({
    queryKey: ["consultations", academyId, studentId],
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("consultations")
        .select("*")
        .eq("academy_id", academyId)
        .eq("student_id", studentId)
        .order("consult_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapConsultation);
    },
    enabled: !!academyId && !!studentId,
  });
}

export function useConsultationMutations(academyId, studentId) {
  const qc = useQueryClient();
  const key = ["consultations", academyId, studentId];
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const addConsultation = useMutation({
    mutationFn: async ({ consultDate, content }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("consultations")
        .insert({ academy_id: academyId, student_id: studentId, consult_date: consultDate, content })
        .select()
        .single();
      if (error) throw error;
      return mapConsultation(data);
    },
    onSuccess: invalidate,
  });

  const updateConsultation = useMutation({
    mutationFn: async ({ id, consultDate, content }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("consultations")
        .update({ consult_date: consultDate, content })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapConsultation(data);
    },
    onSuccess: invalidate,
  });

  const deleteConsultation = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("consultations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addConsultation, updateConsultation, deleteConsultation };
}
