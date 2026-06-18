/** 수강료 관련 개별 공지 · 학부모 푸시 */

import { logBackgroundError } from "./reportError.js";
import { parseMakeupNoticeMeta } from "./makeupNotice.js";

export function getNoticeScope(n) {
  if (n.scope === "individual" || n.scope === "general") return n.scope;
  if (/^\[(미납|D-\d+|납부일|보강)\]/.test(n.title ?? "")) return "individual";
  return "general";
}

export function filterNoticesForParent(notices, studentId) {
  return (notices ?? []).filter((n) => {
    const scope = getNoticeScope(n);
    if (scope === "general") return true;
    return n.studentId && String(n.studentId) === String(studentId);
  });
}

export function isFeeNoticeTitle(title) {
  return /^\[(미납|D-\d+|납부일)\]/.test(title ?? "");
}

export function isMakeupNoticeTitle(title) {
  return /^\[보강\]/.test(title ?? "");
}

/** 학부모 푸시 대상 개별 공지 (수강료·보강) */
export function isParentPushNoticeTitle(title) {
  return isFeeNoticeTitle(title) || isMakeupNoticeTitle(title);
}

export function unpaidNoticeTitle(studentName, monthKey) {
  return `[미납] ${studentName} ${monthKey} 수강료`;
}

export function feeDueNoticeTitle(studentName, daysLeft) {
  return daysLeft === 0
    ? `[납부일] ${studentName} 수강료 납부 오늘`
    : `[D-${daysLeft}] ${studentName} 수강료 납부 임박`;
}

export function buildUnpaidNoticeContent(student, academy, fmtMoney) {
  const bank = academy?.bankName?.trim() || "은행";
  const account = academy?.bankAccount?.trim() || "계좌번호";
  return `${student.name} 학부모님, ${fmtMoney(student.monthlyFee)} 수강료 납부가 아직 확인되지 않았습니다. 매월 ${student.feeDueDay}일까지 ${bank} ${account} 계좌로 납부 부탁드립니다.`;
}

export function buildFeeReminderContent(student, academy, info, fmtMoney) {
  const bank = academy?.bankName?.trim() || "은행";
  const account = academy?.bankAccount?.trim() || "계좌번호";
  const duePart = info.daysLeft === 0 ? "오늘까지" : `${info.daysLeft}일 후`;
  return `${student.name} 학부모님, ${fmtMoney(student.monthlyFee)} 수강료 납부 예정일은 ${info.dueStr}(매월 ${student.feeDueDay}일)입니다. ${duePart} ${bank} ${account} 계좌로 납부 부탁드립니다.`;
}

const NOTIFIED_PREFIX = "artlog_notified_parent_notices:";
const INIT_PREFIX = "artlog_parent_notice_init:v2";

export const feeNoticeStorage = {
  loadNotified(studentId) {
    try {
      return new Set(JSON.parse(localStorage.getItem(`${NOTIFIED_PREFIX}${studentId}`) || "[]"));
    } catch {
      return new Set();
    }
  },
  saveNotified(studentId, set) {
    try {
      localStorage.setItem(`${NOTIFIED_PREFIX}${studentId}`, JSON.stringify([...set].slice(-200)));
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
  seedBaseline(studentId, notices) {
    const today = new Date().toISOString().slice(0, 10);
    const notified = this.loadNotified(studentId);
    (notices ?? [])
      .filter((n) => isParentPushNoticeTitle(n.title) && String(n.studentId) === String(studentId))
      .forEach((n) => {
        if (isMakeupNoticeTitle(n.title)) {
          notified.add(n.id);
          return;
        }
        if ((n.date ?? "") < today) notified.add(n.id);
      });
    this.saveNotified(studentId, notified);
    this.setInitialized(studentId);
    return notified;
  },
};

export async function ensureFeeNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

function parseDaysLeft(title) {
  if (/^\[납부일\]/.test(title ?? "")) return 0;
  const m = /^\[D-(\d+)\]/.exec(title ?? "");
  return m ? Number(m[1]) : null;
}

function parseMakeupFromNotice(notice) {
  const meta = parseMakeupNoticeMeta(notice);
  return { date: meta.date, time: meta.time, title: meta.label };
}

/** 학부모 기기 — 공지 DB 연동 로컬 푸시 (공지당 1회) */
export function dispatchFeeNoticeNotification(notice, { studentName, monthlyFee, feeDueDay }) {
  const title = notice?.title ?? "";

  if (isMakeupNoticeTitle(title)) {
    const { date, time, title: makeupTitle } = parseMakeupFromNotice(notice);
    if (window.ArtlogNative?.notifyMakeup) {
      window.ArtlogNative.notifyMakeup({
        studentName,
        date,
        time,
        title: makeupTitle,
        body: `${date}${time ? ` ${time}` : ""} · ${makeupTitle}`,
      }).catch((e) => logBackgroundError("푸시 알림", e));
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(`${studentName} 보강 안내`, {
          body: `${date}${time ? ` ${time}` : ""} · ${makeupTitle}`,
        });
      } catch { /* ignore */ }
    }
    return;
  }

  if (!isFeeNoticeTitle(title)) return;

  const daysLeft = parseDaysLeft(title);
  const dueMatch = notice.content?.match(/\d{4}-\d{2}-\d{2}/);
  const dueDate = dueMatch?.[0] ?? "";

  if (title.startsWith("[미납]")) {
    if (window.ArtlogNative?.notifyUnpaidReminder) {
      window.ArtlogNative.notifyUnpaidReminder({
        studentName,
        amount: monthlyFee,
        feeDueDay,
      }).catch((e) => logBackgroundError("푸시 알림", e));
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("수강료 미납 안내", {
          body: `${studentName} · ${Number(monthlyFee).toLocaleString()}원`,
        });
      } catch { /* ignore */ }
    }
    return;
  }

  if (window.ArtlogNative?.notifyFeeReminder) {
    window.ArtlogNative.notifyFeeReminder({
      studentName,
      daysLeft: daysLeft ?? 0,
      amount: monthlyFee,
      dueDate,
    }).catch((e) => logBackgroundError("푸시 알림", e));
    return;
  }

  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    const pushTitle = daysLeft === 0 ? "오늘 수강료 납부일" : `수강료 납부 D-${daysLeft}`;
    try {
      new Notification(pushTitle, {
        body: `${studentName} · ${Number(monthlyFee).toLocaleString()}원 · ${dueDate}`,
      });
    } catch { /* ignore */ }
  }
}
