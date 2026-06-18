import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";

const PRACTICAL_KEYS = ["형태력", "채색력", "표현력", "속도", "아이디어"];

export { PRACTICAL_KEYS };

function mapExamScore(row) {
  return {
    id: row.id,
    academyId: row.academy_id,
    studentId: row.student_id,
    examDate: row.exam_date,
    practicalScores: row.practical_scores ?? {},
    suneungScore: row.suneung_score ?? null,
    naesинGrade: row.naesin_grade ?? null,
    targetSchools: row.target_schools ?? [],
    memo: row.memo ?? "",
    createdAt: row.created_at,
  };
}

export function useExamScores(academyId, studentId) {
  return useQuery({
    queryKey: ["exam_scores", academyId, studentId],
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("exam_scores")
        .select("*")
        .eq("academy_id", academyId)
        .eq("student_id", studentId)
        .order("exam_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(mapExamScore);
    },
    enabled: !!academyId && !!studentId,
  });
}

export function useExamScoreMutations(academyId, studentId) {
  const qc = useQueryClient();
  const key = ["exam_scores", academyId, studentId];
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const addScore = useMutation({
    mutationFn: async (payload) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("exam_scores")
        .insert({
          academy_id: academyId,
          student_id: studentId,
          exam_date: payload.examDate,
          practical_scores: payload.practicalScores ?? {},
          suneung_score: payload.suneungScore ?? null,
          naesin_grade: payload.naesинGrade ?? null,
          target_schools: payload.targetSchools ?? [],
          memo: payload.memo ?? "",
        })
        .select()
        .single();
      if (error) throw error;
      return mapExamScore(data);
    },
    onSuccess: invalidate,
  });

  const updateScore = useMutation({
    mutationFn: async ({ id, patch }) => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("exam_scores")
        .update({
          exam_date: patch.examDate,
          practical_scores: patch.practicalScores,
          suneung_score: patch.suneungScore ?? null,
          naesin_grade: patch.naesинGrade ?? null,
          target_schools: patch.targetSchools ?? [],
          memo: patch.memo ?? "",
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapExamScore(data);
    },
    onSuccess: invalidate,
  });

  const deleteScore = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("exam_scores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addScore, updateScore, deleteScore };
}
