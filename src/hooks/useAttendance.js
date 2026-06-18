import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { queryKeys } from "./queryKeys.js";

export function useAttendance(academyId, { refetchInterval = false } = {}) {
  return useQuery({
    queryKey: queryKeys.attendance(academyId),
    queryFn: async () => {
      const sb = requireSupabase();
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data, error } = await sb
        .from("attendance")
        .select("*")
        .eq("academy_id", academyId)
        .gte("attendance_date", since.toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!academyId,
    refetchInterval,
  });
}

export function attendanceToMap(rows, date = new Date().toISOString().slice(0, 10)) {
  const map = {};
  for (const r of rows) {
    const rowDate = String(r.attendance_date ?? r.date ?? "").slice(0, 10);
    if (date && rowDate !== date) continue;
    map[`${r.student_id}:${r.class_time}`] = r.status;
  }
  return map;
}

export function useAttendanceMutations(academyId) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.attendance(academyId) });

  const upsertAttendance = useMutation({
    mutationFn: async ({ studentId, studentName, status, classTime, date }) => {
      const sb = requireSupabase();
      const attendanceDate = date ?? new Date().toISOString().slice(0, 10);
      const { data, error } = await sb
        .from("attendance")
        .upsert(
          {
            academy_id: academyId,
            student_id: studentId,
            student_name: studentName,
            status,
            class_time: classTime,
            attendance_date: attendanceDate,
            checked_at: new Date().toISOString(),
          },
          { onConflict: "academy_id,student_id,attendance_date,class_time" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const syncBatch = useMutation({
    mutationFn: async (items) => {
      const sb = requireSupabase();
      const rows = items.map((item) => ({
        academy_id: academyId,
        student_id: item.student_id ?? item.studentId,
        student_name: item.student_name ?? item.studentName,
        status: item.status,
        class_time: item.class_time ?? item.classTime,
        attendance_date: item.date ?? item.attendance_date,
        checked_at: item.checked_at ?? new Date().toISOString(),
      }));
      const { error } = await sb.from("attendance").upsert(rows, {
        onConflict: "academy_id,student_id,attendance_date,class_time",
      });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: invalidate,
  });

  return { upsertAttendance, syncBatch };
}
