/** 피드백 앱 알림 예약 헬퍼 */

import { logBackgroundError } from "./reportError.js";

export function defaultNotifyDateTime() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30, 0, 0);
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

export function resolveNotifyScheduledAt(mode, date, time) {
  if (mode !== "scheduled") return null;
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function formatNotifyScheduleLabel(iso) {
  if (!iso) return "즉시 발송";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "즉시 발송";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${hh}:${mm}`;
}

export function dispatchFeedbackNotification({ studentName, notifyScheduledAt }) {
  const payload = { studentName, scheduledAt: notifyScheduledAt ?? undefined };
  window.ArtlogNative?.notifyFeedback?.(payload).catch((e) => logBackgroundError("피드백 푸시", e));
}

export function isNotifyDue(notifyScheduledAt) {
  if (!notifyScheduledAt) return true;
  return new Date(notifyScheduledAt).getTime() <= Date.now();
}
