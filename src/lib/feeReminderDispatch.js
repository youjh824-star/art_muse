import { isWithinFeeNoticeHours } from "./feeNotify.js";
import {
  buildFeeReminderContent,
  buildUnpaidNoticeContent,
  feeDueNoticeTitle,
  unpaidNoticeTitle,
} from "./feeNotice.js";
import { daysUntilPaymentDue, getCalendarMonthKey, isPaidForMonth } from "./studentFee.js";

const fmtMoney = (v) => `${Number(v || 0).toLocaleString()}원`;

/** 원장 앱 — 납부 임박(D-3~0) 개별 공지 생성 */
export async function dispatchAcademyFeeReminders({
  students,
  academy,
  addNotice,
  existingNotices = [],
  ref = new Date(),
}) {
  if (!academy?.notifs?.paymentRemind) return;
  if (!isWithinFeeNoticeHours(ref)) return;
  if (!addNotice) return;

  const monthKey = getCalendarMonthKey(ref);

  for (const student of students ?? []) {
    if (isPaidForMonth(student, monthKey)) continue;

    const info = daysUntilPaymentDue(student, ref);
    if (!info || info.daysLeft > 3) continue;

    const title = feeDueNoticeTitle(student.name, info.daysLeft);
    const exists = existingNotices.some(
      (n) => n.title === title && String(n.studentId) === String(student.id)
    );
    if (exists) continue;

    const localDate = `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,"0")}-${String(ref.getDate()).padStart(2,"0")}`;
    await addNotice({
      title,
      content: buildFeeReminderContent(student, academy, info, fmtMoney),
      date: localDate,
      important: info.daysLeft <= 1,
      scope: "individual",
      studentId: student.id,
    });
  }
}

/** 원장 — 미납 알림 공지 생성 (푸시는 학부모 앱에서 공지 감지 후 발송) */
export async function createUnpaidFeeNotice({
  student,
  academy,
  addNotice,
  existingNotices = [],
  ref = new Date(),
}) {
  const monthKey = getCalendarMonthKey(ref);
  const title = unpaidNoticeTitle(student.name, monthKey);
  const exists = existingNotices.some(
    (n) => n.title === title && String(n.studentId) === String(student.id)
  );
  if (exists) return { created: false, title };

  const localDate = `${ref.getFullYear()}-${String(ref.getMonth()+1).padStart(2,"0")}-${String(ref.getDate()).padStart(2,"0")}`;
  await addNotice({
    title,
    content: buildUnpaidNoticeContent(student, academy, fmtMoney),
    date: localDate,
    important: true,
    scope: "individual",
    studentId: student.id,
  });
  return { created: true, title };
}
