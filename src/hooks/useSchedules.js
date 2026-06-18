import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { mapSchedule } from "../lib/mappers.js";
import { queryKeys } from "./queryKeys.js";

function buildStudentName(studentIds, studentName, studentsById) {
  if (studentName?.trim()) return studentName.trim();
  const names = (studentIds ?? [])
    .map((id) => studentsById?.get(id)?.name)
    .filter(Boolean);
  return names.length ? names.join(", ") : null;
}

export function useSchedules(academyId, { refetchInterval = false } = {}) {
  return useQuery({
    queryKey: queryKeys.schedules(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from("schedules")
        .select("*")
        .eq("academy_id", academyId)
        .order("schedule_date");
      if (error) throw error;
      return (data ?? []).map(mapSchedule);
    },
    enabled: !!academyId,
    refetchInterval: refetchInterval || false,
  });
}

export function useScheduleMutations(academyId, students = []) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.schedules(academyId) });
  const studentsById = new Map(students.map((s) => [s.id, s]));

  const addSchedule = useMutation({
    mutationFn: async (s) => {
      const sb = requireSupabase();
      const studentIds = s.studentIds ?? [];
      const studentName = buildStudentName(studentIds, s.studentName, studentsById);
      const { data, error } = await sb
        .from("schedules")
        .insert({
          academy_id: academyId,
          schedule_date: s.date,
          schedule_type: s.type,
          title: s.title,
          schedule_time: s.time,
          student_name: studentName,
          student_ids: studentIds,
          auto_holiday: s.autoHoliday ?? false,
          substitute: s.substitute ?? false,
        })
        .select()
        .single();
      if (error) throw error;
      return mapSchedule(data);
    },
    onSuccess: invalidate,
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, patch }) => {
      const sb = requireSupabase();
      const row = {};
      if (patch.date !== undefined) row.schedule_date = patch.date;
      if (patch.type !== undefined) row.schedule_type = patch.type;
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.time !== undefined) row.schedule_time = patch.time;
      if (patch.studentIds !== undefined) {
        row.student_ids = patch.studentIds;
        row.student_name = buildStudentName(
          patch.studentIds,
          patch.studentName,
          studentsById
        );
      } else if (patch.studentName !== undefined) {
        row.student_name = patch.studentName;
      }
      const { data, error } = await sb.from("schedules").update(row).eq("id", id).select().single();
      if (error) throw error;
      return mapSchedule(data);
    },
    onSuccess: invalidate,
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from("schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { addSchedule, updateSchedule, deleteSchedule };
}
