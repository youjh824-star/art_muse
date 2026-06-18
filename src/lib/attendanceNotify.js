/** 출결 처리 → 학부모 푸시 알림 */

import { logBackgroundError } from "./reportError.js";

const NOTIFIED_PREFIX = "artlog_notified_attendance:";
const INIT_PREFIX = "artlog_attendance_notify_init:";

export function attendanceRecordKey(record) {
  if (record?.id) return String(record.id);
  const sid = record?.student_id ?? record?.studentId;
  const date = record?.attendance_date ?? record?.date ?? "";
  const time = record?.class_time ?? record?.classTime ?? "";
  return `${sid}:${date}:${time}`;
}

export const attendanceStorage = {
  loadNotified(studentId) {
    try {
      return new Set(JSON.parse(localStorage.getItem(`${NOTIFIED_PREFIX}${studentId}`) || "[]"));
    } catch {
      return new Set();
    }
  },
  saveNotified(studentId, set) {
    try {
      localStorage.setItem(`${NOTIFIED_PREFIX}${studentId}`, JSON.stringify([...set].slice(-400)));
    } catch { /* ignore */ }
  },
  isInitialized(studentId) {
    try {
      return localStorage.getItem(`${INIT_PREFIX}${studentId}`) === "1";
    } catch {
      return false;
    }
  },
  setInitialized(studentId) {
    try {
      localStorage.setItem(`${INIT_PREFIX}${studentId}`, "1");
    } catch { /* ignore */ }
  },
  seedBaseline(studentId, records) {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const notified = this.loadNotified(studentId);
    (records ?? [])
      .filter((r) => String(r.student_id ?? r.studentId) === String(studentId))
      .forEach((r) => {
        const date = String(r.attendance_date ?? r.date ?? "").slice(0, 10);
        if (date && date < today) notified.add(attendanceRecordKey(r));
      });
    this.saveNotified(studentId, notified);
    this.setInitialized(studentId);
    return notified;
  },
};

export async function ensureAttendanceNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

const STATUS_LABELS = { present: "출석", late: "지각", absent: "결석", makeup: "보강" };

export function dispatchAttendanceNotification({ studentName, status }) {
  if (window.ArtlogNative?.notifyAttendance) {
    window.ArtlogNative.notifyAttendance({ studentName, status }).catch((e) => logBackgroundError("출결 푸시", e));
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    const label = STATUS_LABELS[status] ?? status;
    try {
      new Notification(`${studentName} ${label}`, { body: "아트뮤즈에서 출결 처리되었습니다." });
    } catch { /* ignore */ }
  }
}
