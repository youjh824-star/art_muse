import { useEffect, useMemo } from "react";
import {
  attendanceRecordKey,
  attendanceStorage,
  dispatchAttendanceNotification,
  ensureAttendanceNotificationPermission,
} from "../lib/attendanceNotify.js";

/** 학부모 앱 — 새 출결 기록 감지 후 푸시 알림 */
export function useAttendanceNotifyWatch(student, attendanceRecords, { enabled = true } = {}) {
  const studentRecords = useMemo(
    () =>
      (attendanceRecords ?? []).filter(
        (r) => String(r.student_id ?? r.studentId) === String(student?.id)
      ),
    [attendanceRecords, student?.id]
  );

  useEffect(() => {
    if (!student?.id || !enabled) return;
    ensureAttendanceNotificationPermission();
  }, [student?.id, enabled]);

  useEffect(() => {
    if (!student?.id || !enabled) return;
    // 출결 데이터 로드 전 빈 배열로 seedBaseline이 실행되면
    // initialized=true만 설정되고 아무것도 시드 안 됨 →
    // 이후 데이터 로드 시 전부 "새 출결"로 인식해 알림 폭탄 발생
    if (studentRecords.length === 0) return;

    let notified = attendanceStorage.loadNotified(student.id);
    if (!attendanceStorage.isInitialized(student.id)) {
      notified = attendanceStorage.seedBaseline(student.id, studentRecords);
      return; // 최초 진입 시에는 기준선만 설정하고 알림 발송하지 않음
    }

    let changed = false;
    for (const record of studentRecords) {
      const key = attendanceRecordKey(record);
      if (notified.has(key)) continue;
      notified.add(key);
      changed = true;
      dispatchAttendanceNotification({
        studentName: student.name,
        status: record.status,
      });
    }

    if (changed) attendanceStorage.saveNotified(student.id, notified);
  }, [student?.id, student?.name, studentRecords, enabled]);
}
