import { useEffect, useMemo } from "react";
import { isNotifyDue } from "../lib/feedbackNotify.js";
import { logBackgroundError } from "../lib/reportError.js";

const NOTIFIED_PREFIX = "artlog_notified_feedback:";
const INIT_PREFIX = "artlog_feedback_notify_init:";

export const feedbackStorage = {
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
  /** 최초 진입 시 기존 피드백을 모두 이미 알림 처리 (과거 항목 스팸 방지) */
  seedBaseline(studentId, feedbacks) {
    const notified = this.loadNotified(studentId);
    (feedbacks ?? []).forEach((f) => notified.add(String(f.id)));
    this.saveNotified(studentId, notified);
    this.setInitialized(studentId);
    return notified;
  },
};

function dispatchFeedbackReceivedNotification({ studentName }) {
  if (window.ArtlogNative?.notifyFeedbackReceived) {
    window.ArtlogNative
      .notifyFeedbackReceived({ studentName })
      .catch((e) => logBackgroundError("피드백 수신 푸시", e));
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification("새 피드백이 도착했습니다", {
        body: `${studentName} 학생의 선생님 피드백을 확인해 보세요.`,
      });
    } catch { /* ignore */ }
  }
}

/** 학부모 앱 — 새 피드백 감지 후 로컬 알림 (피드백당 1회) */
export function useFeedbackNotifyWatch(student, feedbacks, { enabled = true } = {}) {
  const studentFeedbacks = useMemo(
    () =>
      (feedbacks ?? []).filter(
        (f) => String(f.studentId) === String(student?.id)
      ),
    [feedbacks, student?.id]
  );

  useEffect(() => {
    if (!student?.id || !enabled) return;
    // 알림 권한 요청은 useFeeNoticeWatch에서 이미 처리되므로 여기선 생략
  }, [student?.id, enabled]);

  useEffect(() => {
    if (!student?.id || !enabled) return;
    // 피드백 로드 전에는 실행 안 함 — 빈 배열로 seedBaseline 오작동 방지
    if (studentFeedbacks.length === 0) return;

    let notified = feedbackStorage.loadNotified(student.id);

    // 최초 진입 시 기존 피드백 전부 기준선으로 설정 (앱 업데이트·재설치 후 스팸 방지)
    if (!feedbackStorage.isInitialized(student.id)) {
      notified = feedbackStorage.seedBaseline(student.id, studentFeedbacks);
      return;
    }

    let changed = false;
    for (const f of studentFeedbacks) {
      if (notified.has(String(f.id))) continue;
      // 이미 읽은 피드백은 localStorage 초기화에 관계없이 절대 알림 안 뜸 (DB 기반)
      if (f.read) {
        notified.add(String(f.id));
        changed = true;
        continue;
      }
      if (!isNotifyDue(f.notifyScheduledAt)) continue; // 예약 시간 미도래
      notified.add(String(f.id));
      changed = true;
      dispatchFeedbackReceivedNotification({ studentName: student.name });
    }

    if (changed) feedbackStorage.saveNotified(student.id, notified);
  }, [student?.id, student?.name, studentFeedbacks, enabled]);
}
