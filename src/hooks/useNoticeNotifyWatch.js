import { useEffect, useMemo } from "react";
import { logBackgroundError } from "../lib/reportError.js";
import { isParentPushNoticeTitle } from "../lib/feeNotice.js";

const NOTIFIED_PREFIX = "artlog_notified_general_notice:";
const INIT_PREFIX = "artlog_general_notice_init:";
const MAX_AGE_MS = 72 * 60 * 60 * 1000; // 72시간 이내 공지만 알림

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
    (notices ?? []).forEach((n) => { if (n.id != null) notified.add(String(n.id)); });
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
  // useMemo로 배열 안정화 — 내용이 같으면 새 배열 참조가 와도 effect 불필요하게 실행 안 함
  const targetNotices = useMemo(
    () => (notices ?? []).filter((n) => !isParentPushNoticeTitle(n.title)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notices]
  );

  // 72시간 이내 공지만 알림 대상 (오래된 공지 재알림 방지)
  const recentNotices = useMemo(() => {
    const cutoff = Date.now() - MAX_AGE_MS;
    return targetNotices.filter((n) => {
      if (!n.createdAt) return true; // createdAt 없으면 포함 (안전 기본값)
      return new Date(n.createdAt).getTime() > cutoff;
    });
  }, [targetNotices]);

  useEffect(() => {
    if (!student?.id || !targetNotices.length) return;

    // 관련 공지 없으면 초기화 연기
    if (!generalNoticeStorage.isInitialized(student.id) && targetNotices.length === 0) return;

    let notified = generalNoticeStorage.loadNotified(student.id);

    if (!generalNoticeStorage.isInitialized(student.id)) {
      notified = generalNoticeStorage.seedBaseline(student.id, targetNotices);
      return; // 최초 진입 시 기준선만 설정
    }

    // 최신 공지 중 아직 알림 안 보낸 것만 처리
    let changed = false;
    for (const n of recentNotices) {
      if (n.id == null) continue;
      if (notified.has(String(n.id))) continue;
      notified.add(String(n.id));
      changed = true;
      dispatchGeneralNoticeNotification({ title: n.title, important: n.important });
    }

    // 오래된 공지도 notified에 기록 (다음 조회 때 중복 체크용)
    for (const n of targetNotices) {
      if (n.id == null) continue;
      if (!notified.has(String(n.id))) {
        notified.add(String(n.id));
        changed = true;
      }
    }

    if (changed) generalNoticeStorage.saveNotified(student.id, notified);
  }, [student?.id, targetNotices, recentNotices]);
}
