/** DB snake_case ↔ UI camelCase */

import { getSchoolYear } from "./studentGrade.js";
import { normalizeFeePayments } from "./studentFee.js";

export function mapStudent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    school: row.school ?? "",
    grade: row.grade ?? "",
    gradeAsOfYear: row.grade_as_of_year ?? null,
    classDay: row.class_days ?? [],
    classTime: row.class_time ?? "",
    tags: row.tags ?? [],
    status: row.status,
    fee: row.fee_status ?? "예정",
    art: row.art_emoji ?? "🎨",
    photoUri: row.photo_url ?? null,
    photoPath: row.photo_path ?? null,
    useEmojiAvatar: row.use_emoji_avatar ?? false,
    gender: row.gender ?? "",
    artCount: row.art_count ?? 0,
    phone: row.phone ?? "",
    parentPhone: row.parent_phone ?? "",
    enroll: row.enroll_date ?? "",
    monthlyFee: row.monthly_fee ?? 0,
    feeDueDay: row.fee_due_day ?? 5,
    lastPaymentDate: row.last_payment_date ?? null,
    lastPaymentMethod: row.last_payment_method ?? null,
    feePaidMonth: row.fee_paid_month ?? null,
    feePayments: normalizeFeePayments(row.fee_payments, row),
    memo: row.memo ?? "",
  };
}

export function mapStudentToDb(patch, academyId) {
  const out = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.school !== undefined) out.school = patch.school;
  if (patch.grade !== undefined) {
    out.grade = patch.grade;
    out.grade_as_of_year = patch.gradeAsOfYear ?? getSchoolYear();
  }
  if (patch.gradeAsOfYear !== undefined && patch.grade === undefined) {
    out.grade_as_of_year = patch.gradeAsOfYear;
  }
  if (patch.classDay !== undefined) out.class_days = patch.classDay;
  if (patch.classTime !== undefined) out.class_time = patch.classTime;
  if (patch.tags !== undefined) out.tags = patch.tags;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.fee !== undefined) out.fee_status = patch.fee;
  if (patch.feePaidMonth !== undefined) out.fee_paid_month = patch.feePaidMonth;
  if (patch.lastPaymentDate !== undefined) out.last_payment_date = patch.lastPaymentDate;
  if (patch.lastPaymentMethod !== undefined) out.last_payment_method = patch.lastPaymentMethod;
  if (patch.feePayments !== undefined) out.fee_payments = patch.feePayments;
  if (patch.art !== undefined) out.art_emoji = patch.art;
  if (patch.useEmojiAvatar !== undefined) out.use_emoji_avatar = patch.useEmojiAvatar;
  if (patch.gender !== undefined) out.gender = patch.gender || null;
  if (patch.artCount !== undefined) out.art_count = patch.artCount;
  if (patch.phone !== undefined) out.phone = patch.phone;
  if (patch.parentPhone !== undefined) out.parent_phone = patch.parentPhone;
  if (patch.enroll !== undefined) out.enroll_date = patch.enroll;
  if (patch.monthlyFee !== undefined) out.monthly_fee = patch.monthlyFee;
  if (patch.feeDueDay !== undefined) out.fee_due_day = patch.feeDueDay;
  if (patch.memo !== undefined) out.memo = patch.memo;
  if (academyId) out.academy_id = academyId;
  return out;
}

export function mapArtwork(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name ?? row.students?.name ?? "",
    title: row.title,
    medium: row.medium ?? "",
    date: row.work_date ?? row.date ?? "",
    emoji: row.emoji ?? "🎨",
    progress: row.progress ?? 0,
    desc: row.description ?? "",
    photoUri: row.photo_url ?? null,
    photoPath: row.photo_path ?? null,
    uploadedBy: row.uploaded_by ?? "teacher",
  };
}

export function mapFeedback(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name ?? row.students?.name ?? "",
    content: row.content,
    date: row.feedback_date ?? row.created_at?.slice(0, 10) ?? "",
    createdAt: row.created_at ?? "",
    read: row.is_read ?? false,
    artwork: row.artwork_title ?? "",
    artEmoji: row.art_emoji ?? "🎨",
    notifyScheduledAt: row.notify_scheduled_at ?? null,
    notifySent: row.notify_sent ?? false,
  };
}

/** 최근 피드백이 위로 — 날짜 내림차순, 동일 날짜는 생성 시각 기준 */
export function sortFeedbacksRecentFirst(items) {
  return [...(items ?? [])].sort((a, b) => {
    const byDate = (b.date ?? "").localeCompare(a.date ?? "");
    if (byDate !== 0) return byDate;
    return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  });
}

export function mapNotice(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.notice_date ?? row.created_at?.slice(0, 10) ?? "",
    important: row.important ?? false,
    scope: row.notice_scope ?? "general",
    studentId: row.student_id ?? null,
  };
}

export function mapSchedule(row) {
  if (!row) return null;
  const studentIds = row.student_ids ?? [];
  return {
    id: row.id,
    date: row.schedule_date,
    type: row.schedule_type,
    title: row.title,
    time: row.schedule_time,
    studentName: row.student_name,
    studentIds,
    studentId: studentIds[0] ?? null,
    autoHoliday: row.auto_holiday ?? false,
    substitute: row.substitute ?? false,
  };
}

export function mapInvite(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    studentId: row.student_id,
    studentName: row.student_name ?? row.students?.name ?? "",
    studentArt: row.student_art ?? row.students?.art_emoji ?? "🎨",
    createdAt: row.created_at?.slice(0, 10) ?? "",
    expiresAt: row.expires_at?.slice(0, 10) ?? "",
    used: row.used ?? false,
  };
}

export function mapLinkedParent(row) {
  if (!row) return null;
  const profile = row.profiles ?? row.parent_profile;
  const student = row.students ?? {};
  return {
    id: row.id,
    parentUserId: row.parent_user_id ?? null,
    name: profile?.full_name ?? row.parent_name ?? student.parent_phone ?? "학부모",
    phone: profile?.phone ?? student.parent_phone ?? row.parent_phone ?? "",
    studentId: row.student_id,
    studentName: student.name ?? row.student_name ?? "",
    studentArt: student.art_emoji ?? row.student_art ?? "🎨",
    joinedAt: row.joined_at?.slice(0, 10) ?? "",
    fcm: row.push_enabled ?? false,
  };
}

export function mapLinkedParentRpc(row) {
  if (!row) return null;
  return {
    id: row.id,
    parentUserId: row.parent_user_id ?? null,
    name: row.parent_name ?? "학부모",
    phone: row.parent_phone ?? "",
    studentId: row.student_id,
    studentName: row.student_name ?? "",
    studentArt: row.student_art ?? "🎨",
    joinedAt: row.joined_at?.slice(0, 10) ?? "",
    fcm: row.push_enabled ?? false,
  };
}

export function normalizePhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

/** 학부모 계정 식별 — 동일 연락처는 한 계정으로 취급 */
export function parentAccountKey(link) {
  const phone = normalizePhone(link.phone);
  if (phone.length >= 8) return `phone:${phone}`;
  if (link.parentUserId) return `uid:${String(link.parentUserId)}`;
  const name = String(link.name ?? "").trim().toLowerCase();
  if (name && name !== "학부모") return `name:${name}`;
  return `link:${link.id}`;
}

/** DB에 동일 parent_user_id + student_id 중복 행만 제거 */
function dedupeLinkedParents(rows) {
  const best = new Map();
  for (const row of rows) {
    if (!row) continue;
    const key = `${row.parentUserId ?? "unknown"}:${row.studentId}`;
    const prev = best.get(key);
    if (!prev || String(row.joinedAt ?? "") > String(prev.joinedAt ?? "")) {
      best.set(key, row);
    }
  }
  return [...best.values()];
}

export function groupLinkedParentsByAccount(linkedParents) {
  const groups = new Map();
  for (const link of linkedParents) {
    if (!link) continue;
    const key = parentAccountKey(link);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        parentUserId: link.parentUserId,
        name: link.name,
        phone: link.phone,
        joinedAt: link.joinedAt,
        children: [],
      });
    }
    const group = groups.get(key);
    const existing = group.children.find((c) => String(c.studentId) === String(link.studentId));
    if (existing) {
      if (!existing.linkIds.includes(link.id)) existing.linkIds.push(link.id);
      existing.fcm = existing.fcm || link.fcm;
    } else {
      group.children.push({
        linkId: link.id,
        linkIds: [link.id],
        studentId: link.studentId,
        studentName: link.studentName,
        studentArt: link.studentArt,
        fcm: link.fcm,
      });
    }
    if (link.joinedAt && (!group.joinedAt || link.joinedAt < group.joinedAt)) {
      group.joinedAt = link.joinedAt;
    }
  }
  return [...groups.values()];
}

export { dedupeLinkedParents };

export function mapDisconnectedParent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.parent_name ?? "학부모",
    phone: row.parent_phone ?? "",
    studentId: row.student_id,
    studentName: row.student_name ?? "",
    studentArt: row.student_art ?? "🎨",
    joinedAt: row.joined_at?.slice(0, 10) ?? "",
    disconnectedAt: row.disconnected_at?.slice(0, 10) ?? "",
    reason: row.reason ?? "withdrawn",
  };
}

export function mapAcademy(row) {
  if (!row) return null;
  const notifs = row.notifs ?? {};
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline ?? "",
    phone: row.phone ?? "",
    addr: row.addr ?? "",
    email: row.email ?? "",
    logoUrl: row.logo_url ?? null,
    bankName: row.bank_name ?? "",
    bankAccount: row.bank_account ?? "",
    notifs: {
      attendPush: notifs.attendPush ?? true,
      feedbackPush: notifs.feedbackPush ?? true,
      paymentRemind: notifs.paymentRemind ?? true,
      noticePush: notifs.noticePush ?? true,
    },
  };
}

export function mapAcademyOptions(row) {
  if (!row) {
    return {
      classTimes: ["14:00", "15:00", "16:00", "17:00"],
      monthlyFees: [100000, 120000, 130000, 150000, 170000, 200000],
      feeDueDays: [1, 5, 10, 15, 20, 25],
    };
  }
  return {
    classTimes: row.class_times ?? [],
    monthlyFees: row.monthly_fees ?? [],
    feeDueDays: row.fee_due_days ?? [],
  };
}

export function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    academyId: row.academy_id,
    role: row.role,
    fullName: row.full_name ?? "",
    phone: row.phone ?? "",
  };
}
