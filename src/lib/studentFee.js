/** 월별 수강료 납부 확인 — 매달 1일 기준 달력 월 */

export function getCalendarMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function normalizeFeePayments(raw, row = null) {
  let fp = raw ?? {};
  if (typeof fp === "string") {
    try {
      fp = JSON.parse(fp);
    } catch {
      fp = {};
    }
  }
  if (!fp || typeof fp !== "object" || Array.isArray(fp)) fp = {};

  if (Object.keys(fp).length === 0 && row?.fee_paid_month && row?.fee_status === "납부완료") {
    fp = {
      [row.fee_paid_month]: {
        date: row.last_payment_date ?? `${row.fee_paid_month}-01`,
        method: row.last_payment_method ?? "",
      },
    };
  }
  return fp;
}

export function getMonthPayment(student, monthKey) {
  const fp = student?.feePayments ?? {};
  const entry = fp[monthKey];
  if (!entry || typeof entry !== "object") return null;
  return { date: entry.date ?? null, method: entry.method ?? "" };
}

export function isPaidForMonth(student, monthKey) {
  return !!getMonthPayment(student, monthKey);
}

export function upsertMonthPayment(feePayments, monthKey, { date, method }) {
  return {
    ...(feePayments ?? {}),
    [monthKey]: { date, method: method ?? "" },
  };
}

export function removeMonthPayment(feePayments, monthKey) {
  const next = { ...(feePayments ?? {}) };
  delete next[monthKey];
  return next;
}

export function monthRevenueTotal(students, monthKey) {
  return (students ?? []).reduce((sum, s) => {
    if (!isPaidForMonth(s, monthKey)) return sum;
    return sum + (s.monthlyFee || 0);
  }, 0);
}

export function buildMonthlyRevenue(students, monthCount = 6, ref = new Date()) {
  const months = [];
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({
      key,
      m: `${d.getMonth() + 1}월`,
      v: monthRevenueTotal(students, key),
    });
  }
  return months;
}

export function paymentDueDay(year, month, feeDueDay) {
  const last = new Date(year, month, 0).getDate();
  return Math.min(feeDueDay, last);
}

export function paymentDateForMonth(monthKey, feeDueDay) {
  const [y, m] = monthKey.split("-").map(Number);
  const day = paymentDueDay(y, m, feeDueDay);
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

export function daysUntilPaymentDue(student, ref = new Date()) {
  if (!student || isPaidForMonth(student, getCalendarMonthKey(ref))) return null;
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  let y = ref.getFullYear();
  let m = ref.getMonth() + 1;
  for (let i = 0; i < 2; i++) {
    const monthKey = `${y}-${String(m).padStart(2, "0")}`;
    const dueStr = paymentDateForMonth(monthKey, student.feeDueDay);
    const due = new Date(`${dueStr}T12:00:00`);
    const diff = Math.round((due - today) / 86400000);
    if (diff >= 0) return { daysLeft: diff, dueStr, year: y, month: m, monthKey };
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return null;
}

/** 지난달 납부완료 → 이번 달 미납으로 초기화 (fee_payments 이력은 유지) */
export function applyFeeMonthReset(mapped, dbRow = null) {
  const source = dbRow ?? mapped;
  const currentMonth = getCalendarMonthKey();
  const feePayments = mapped.feePayments ?? normalizeFeePayments(source.fee_payments, source);

  if (isPaidForMonth({ ...mapped, feePayments }, currentMonth)) {
    const payment = getMonthPayment({ feePayments }, currentMonth);
    return {
      ...mapped,
      feePayments,
      fee: "납부완료",
      feePaidMonth: currentMonth,
      lastPaymentDate: payment?.date ?? mapped.lastPaymentDate,
      lastPaymentMethod: payment?.method ?? mapped.lastPaymentMethod,
    };
  }

  if (mapped.fee !== "납부완료") {
    return { ...mapped, feePayments, feePaidMonth: null };
  }

  return {
    ...mapped,
    feePayments,
    fee: "미납",
    feePaidMonth: null,
    _needsFeeReset: true,
  };
}

export function stripFeeResetMeta(student) {
  const { _needsFeeReset, ...rest } = student;
  return rest;
}

export function syncCurrentMonthFeeFields(feePayments, monthKey, payStatus, method, date) {
  const currentMonth = getCalendarMonthKey();
  if (monthKey !== currentMonth) return {};

  if (payStatus === "납부완료") {
    const payment = getMonthPayment({ feePayments }, monthKey);
    return {
      fee: "납부완료",
      feePaidMonth: monthKey,
      lastPaymentDate: payment?.date ?? date,
      lastPaymentMethod: payment?.method ?? method,
    };
  }
  return {
    fee: "미납",
    feePaidMonth: null,
    lastPaymentDate: null,
    lastPaymentMethod: null,
  };
}
