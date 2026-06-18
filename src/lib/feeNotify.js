/** 수강료 납부 예정·미납 알림 발송 가능 시간 (08:00–21:00, 21시 미포함) */
export const FEE_NOTICE_START_HOUR = 8;
export const FEE_NOTICE_END_HOUR = 21;

export function isWithinFeeNoticeHours(ref = new Date()) {
  const hour = ref.getHours();
  return hour >= FEE_NOTICE_START_HOUR && hour < FEE_NOTICE_END_HOUR;
}

/** 다음 발송 가능 시각(08:00)까지 남은 ms — 현재 발송 불가 시간대일 때만 사용 */
export function msUntilNextFeeNoticeWindow(ref = new Date()) {
  const next = new Date(ref);
  if (ref.getHours() < FEE_NOTICE_START_HOUR) {
    next.setHours(FEE_NOTICE_START_HOUR, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(FEE_NOTICE_START_HOUR, 0, 0, 0);
  }
  return Math.max(0, next.getTime() - ref.getTime());
}

export function feeNoticeWindowLabel() {
  const endLabel =
    FEE_NOTICE_END_HOUR > 12
      ? `오후 ${FEE_NOTICE_END_HOUR - 12}시`
      : `오전 ${FEE_NOTICE_END_HOUR}시`;
  return `오전 ${FEE_NOTICE_START_HOUR}시~${endLabel}`;
}
