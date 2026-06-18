import { useEffect } from "react";
import { logBackgroundError } from "../lib/reportError.js";
import { isParentPushNoticeTitle } from "../lib/feeNotice.js";

const NOTIFIED_PREFIX = "artlog_notified_general_notice:";
const INIT_PREFIX = "artlog_general_notice_init:";

const generalNoticeStorage = {
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
  seedBaseline(studentId, notices) {
    const notified = this.loadNotified(studentId);
    (notices ?? []).forEach((n) => notified.add(String(n.id)));
    this.saveNotified(studentId, notified);
    try { localStorage.setItem(`${INIT_PREFIX}${studentId}`, "1"); } catch { /* ignore */ }
    return notified;
  },
};

function dispatchGeneralNoticeNotification({ title, important }) {
  if (window.ArtlogNative?.notifyNotice) {
    window.ArtlogNative
      .notifyNotice({ title, important })
      .catch((e) => logBackgroundError("공지 푸시", e));
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      const pushTitle = important ? `📢 중요 공지: ${title}` : "📢 새 공지사항";
      const body = important ? "중요 공지가 등록되었습니다. 확인해 주세요." : title;
      new Notification(pushTitle, { body });
    } catch { /* ignore */ }
  }
}

/**
 * 학부모 앱 — 일반·중요 공지 새 등록 시 알림 (공지당 1회)
 * 수강료·보강 공지는 useFeeNoticeWatch에서 처리하므로 여기선 제외
 */
export function useNoticeNotifyWatch(student, notices) {
  useEffect(() => {
    if (!student?.id || !notices?.length) return;

    // 일반 공지 + 해당 학생 개별 공지 중 수강료·보강이 아닌 것
    const targetNotices = (notices ?? []).filter(
      (n) => !isParentPushNoticeTitle(n.title)
    );

    // 관련 공지 없으면 초기화 연기
    if (!generalNoticeStorage.isInitialized(student.id) && targetNotices.length === 0) return;

    let notified = generalNoticeStorage.loadNotified(student.id);

    if (!generalNoticeStorage.isInitialized(student.id)) {
      notified = generalNoticeStorage.seedBaseline(student.id, targetNotices);
      return; // 최초 진입 시 기준선만 설정
    }

    let changed = false;
    for (const n of targetNotices) {
      if (notified.has(String(n.id))) continue;
      notified.add(String(n.id));
      changed = true;
      dispatchGeneralNoticeNotification({ title: n.title, important: n.important });
    }

    if (changed) generalNoticeStorage.saveNotified(student.id, notified);
  }, [student?.id, notices]);
}
