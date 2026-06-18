import { useEffect } from "react";
import {
  dispatchFeeNoticeNotification,
  ensureFeeNotificationPermission,
  feeNoticeStorage,
  isParentPushNoticeTitle,
} from "../lib/feeNotice.js";

/** 학부모 앱 — 새 개별 공지(수강료·보강) 감지 후 푸시 (공지당 1회) */
export function useFeeNoticeWatch(student, notices) {
  useEffect(() => {
    if (!student?.id) return;
    ensureFeeNotificationPermission();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;

    const pushNotices = (notices ?? []).filter(
      (n) => isParentPushNoticeTitle(n.title) && String(n.studentId) === String(student.id)
    );

    // 관련 공지가 없으면 초기화 연기 — 빈 배열로 seedBaseline이 실행되면
    // initialized=true만 설정되고 아무것도 시드 안 됨 →
    // 이후 공지 로드 시 전부 "새 공지"로 인식해 알림 폭탄 발생
    if (!feeNoticeStorage.isInitialized(student.id) && pushNotices.length === 0) return;

    let notified = feeNoticeStorage.loadNotified(student.id);
    if (!feeNoticeStorage.isInitialized(student.id)) {
      notified = feeNoticeStorage.seedBaseline(student.id, notices);
      return; // 최초 진입 시에는 기준선만 설정하고 알림 발송하지 않음
    }

    // 같은 제목+날짜의 공지는 1회만 알림
    // (admin 루프 버그로 동일 공지가 여러 개 생성된 경우 중복 알림 방지)
    const firedTitles = new Set();

    let changed = false;
    for (const n of pushNotices) {
      // ID 기준 중복 체크
      if (notified.has(n.id)) {
        firedTitles.add(`${n.title}::${n.date ?? ""}`);
        continue;
      }
      // 같은 제목+날짜 조합이 이미 이번 사이클에서 알림 발송됐으면 스킵
      const titleKey = `${n.title}::${n.date ?? ""}`;
      if (firedTitles.has(titleKey)) {
        notified.add(n.id);  // ID는 기록해 다음번 재발송 방지
        changed = true;
        continue;
      }
      firedTitles.add(titleKey);
      notified.add(n.id);
      changed = true;
      dispatchFeeNoticeNotification(n, {
        studentName: student.name,
        monthlyFee: student.monthlyFee,
        feeDueDay: student.feeDueDay,
      });
    }

    if (changed) feeNoticeStorage.saveNotified(student.id, notified);
  }, [student?.id, student?.name, student?.monthlyFee, student?.feeDueDay, notices]);
}
