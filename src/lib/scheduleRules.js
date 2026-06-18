/** 일정(휴원·보강·정규 수업) 연동 규칙 */

export function getSchedulesForDate(schedules, dateStr) {
  return (schedules ?? []).filter((s) => s.date === dateStr);
}

/** 휴원·공휴일 — 정규 수업 숨김 */
export function isAcademyClosedOnDate(schedules, dateStr) {
  return getSchedulesForDate(schedules, dateStr).some(
    (s) => s.type === "closure" || s.type === "holiday" || s.autoHoliday
  );
}

export function getMakeupSchedulesForDate(schedules, dateStr) {
  return getSchedulesForDate(schedules, dateStr).filter((s) => s.type === "makeup");
}

export function scheduleIncludesStudent(schedule, studentId, studentName) {
  if (!schedule || !studentId) return false;
  const ids = schedule.studentIds ?? [];
  if (ids.some((id) => String(id) === String(studentId))) return true;
  if (schedule.studentId && String(schedule.studentId) === String(studentId)) return true;
  if (studentName && schedule.studentName) {
    const names = schedule.studentName.split(/,\s*/).map((n) => n.trim());
    if (names.includes(studentName)) return true;
  }
  return false;
}

export function getMakeupStudentIdsForDateTime(schedules, dateStr, time) {
  const ids = new Set();
  getMakeupSchedulesForDate(schedules, dateStr)
    .filter((s) => s.time === time)
    .forEach((s) => {
      (s.studentIds ?? []).forEach((id) => ids.add(id));
      if (s.studentId) ids.add(s.studentId);
    });
  return ids;
}

export function getMakeupStudentsForDateTime(students, schedules, dateStr, time) {
  const ids = getMakeupStudentIdsForDateTime(schedules, dateStr, time);
  return (students ?? []).filter((s) => ids.has(s.id));
}

export function shouldShowRegularClassForStudent(student, dateStr, schedules, dowCode) {
  if (isAcademyClosedOnDate(schedules, dateStr)) return false;
  if (!student?.classDay?.includes(dowCode)) return false;
  return true;
}

export function getActiveAttendanceStudents({
  students,
  schedules,
  dateStr,
  dowCode,
  activeTime,
}) {
  if (!activeTime) return [];

  const closed = isAcademyClosedOnDate(schedules, dateStr);
  const makeupIds = getMakeupStudentIdsForDateTime(schedules, dateStr, activeTime);

  const regular = closed
    ? []
    : (students ?? []).filter(
        (s) => s.classDay?.includes(dowCode) && s.classTime === activeTime
      );

  const byId = new Map();
  regular.forEach((s) => {
    byId.set(s.id, { ...s, isMakeupSession: makeupIds.has(s.id) });
  });
  makeupIds.forEach((id) => {
    const s = (students ?? []).find((st) => st.id === id);
    if (s) {
      byId.set(id, { ...s, isMakeupSession: true });
    }
  });

  return [...byId.values()];
}

/** 학부모 캘린더용 일정 (해당 학생 관련만) */
export function getParentEventsForDay({
  student,
  schedules,
  year,
  mon,
  day,
  extraEvents = [],
}) {
  const dateStr = `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const academy = (schedules ?? []).filter((s) => {
    const [sy, sm, sd] = s.date.split("-").map(Number);
    if (sy !== year || sm !== mon || sd !== day) return false;
    if (s.type === "makeup") return scheduleIncludesStudent(s, student.id, student.name);
    if (s.type === "class" || s.type === "event" || s.type === "closure" || s.type === "holiday") {
      return true;
    }
    return !s.studentIds?.length && !s.studentId;
  });

  const code = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(year, mon - 1, day).getDay()];
  const hasStudentMakeup = academy.some(
    (e) => e.type === "makeup" && scheduleIncludesStudent(e, student.id, student.name)
  );

  const extra = [...extraEvents];
  if (
    shouldShowRegularClassForStudent(student, dateStr, schedules, code) &&
    !hasStudentMakeup
  ) {
    extra.push({
      id: `class-${year}-${mon}-${day}`,
      type: "class",
      title: "정규 수업",
      time: student.classTime,
      studentName: student.name,
    });
  }

  return [...academy, ...extra];
}

export function formatScheduleStudentNames(schedule, students) {
  const ids = schedule?.studentIds ?? (schedule?.studentId ? [schedule.studentId] : []);
  const names = (students ?? [])
    .filter((s) => ids.includes(s.id))
    .map((s) => s.name);
  if (names.length) return names.join(", ");
  return schedule?.studentName ?? "";
}

export function makeupTimesForDate(schedules, dateStr) {
  return [
    ...new Set(
      getMakeupSchedulesForDate(schedules, dateStr)
        .map((s) => s.time)
        .filter(Boolean)
    ),
  ];
}
