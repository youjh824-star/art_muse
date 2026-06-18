/** 학년 목록 (유치 → 초등 → 중등 → 고등) */
export const GRADES = [
  "유4", "유5", "유6", "유7",
  "초1", "초2", "초3", "초4", "초5", "초6",
  "중1", "중2", "중3",
  "고1", "고2", "고3",
];

/** 한국 학년도 — 3월 1일 기준 */
export function getSchoolYear(date = new Date()) {
  const y = date.getFullYear();
  return date.getMonth() >= 2 ? y : y - 1;
}

export function promoteGrade(grade) {
  const idx = GRADES.indexOf(grade);
  if (idx < 0 || idx >= GRADES.length - 1) return grade;
  return GRADES[idx + 1];
}

export function inferGradeAsOfYear(row) {
  if (!row) return getSchoolYear();
  if (row.grade_as_of_year != null) return row.grade_as_of_year;
  if (row.gradeAsOfYear != null) return row.gradeAsOfYear;
  const ref = row.enroll_date ?? row.enroll ?? row.created_at;
  if (ref) return getSchoolYear(new Date(String(ref).slice(0, 10)));
  return getSchoolYear();
}

/** 저장된 학년을 현재 학년도까지 자동 승급 */
export function computeEffectiveGrade(grade, gradeAsOfYear, now = new Date()) {
  const currentYear = getSchoolYear(now);
  const baseYear = gradeAsOfYear ?? currentYear;
  let g = grade || "";
  let year = baseYear;

  while (year < currentYear && g) {
    const next = promoteGrade(g);
    if (next === g) break;
    g = next;
    year += 1;
  }

  return {
    grade: g,
    gradeAsOfYear: year,
    promoted: year > baseYear,
  };
}

export function applyGradePromotion(mapped, dbRow = null) {
  const source = dbRow ?? mapped;
  const baseYear = inferGradeAsOfYear(source);
  const { grade, gradeAsOfYear, promoted } = computeEffectiveGrade(mapped.grade, baseYear);
  return {
    ...mapped,
    grade,
    gradeAsOfYear,
    _needsGradePersist: promoted,
  };
}

export function stripGradePromotionMeta(student) {
  const { _needsGradePersist, ...rest } = student;
  return rest;
}
