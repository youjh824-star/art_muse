import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "../lib/supabase.js";
import { queryKeys } from "./queryKeys.js";

const STATUS_LABELS = { present: "출석", late: "지각", absent: "결석", makeup: "보강" };

async function sendAttendancePush({ academyId, studentId, studentName, status }) {
  try {
    const sb = requireSupabase();
    const { data: rows } = await sb
      .from("parent_student_links")
      .select("push_token")
      .eq("academy_id", academyId)
      .eq("student_id", studentId)
      .not("push_token", "is", null);
    const tokens = (rows ?? []).map(r => r.push_token).filter(Boolean);
    if (!tokens.length) return;
    const label = STATUS_LABELS[status] ?? status;
    await sb.functions.invoke("push-notify", {
      body: { tokens, title: `${studentName} ${label}`, body: "아트뮤즈에서 출결 처리되었습니다.", data: { type: "attendance" } },
    });
  } catch { /* silent */ }
}

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
    onSuccess: (data) => {
      invalidate();
      sendAttendancePush({ academyId, studentId: data.student_id, studentName: data.student_name, status: data.status });
    },
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
