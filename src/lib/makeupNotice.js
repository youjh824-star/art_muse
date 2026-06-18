/** 보강 일정 → 학부모 개별 공지 자동 발송 */

export function makeupNoticeTitle(studentName, date, time) {
  const when = time?.trim() ? `${date} ${time.trim()}` : date;
  return `[보강] ${studentName} ${when} 보강 안내`;
}

export function makeupNoticeContent({ studentName, date, time, title, academyName }) {
  const when = time ? `${date} ${time}` : date;
  const label = title?.trim() || "보강 수업";
  return `${studentName} 학부모님, ${academyName || "미술학원"}에서 보강 수업이 예정되었습니다.

📅 일시: ${when}
📝 ${label}

앱 「일정」·「공지」 탭에서도 확인하실 수 있습니다.`;
}

/** 공지 중복 판별 — 날짜·시간·보강 제목이 같을 때만 스킵 */
export function makeupNoticeSignature({ date, time, title }) {
  return `${date}|${time ?? ""}|${(title ?? "").trim()}`;
}

export function parseMakeupNoticeMeta(notice) {
  const noticeTitle = notice?.title ?? "";
  const withTime = /^\[보강\]\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s+보강 안내/.exec(noticeTitle);
  if (withTime) {
    const labelMatch = notice?.content?.match(/📝\s*(.+)/);
    return {
      date: withTime[2],
      time: withTime[3],
      label: labelMatch?.[1]?.trim().split("\n")[0] ?? "보강 수업",
    };
  }
  const legacy = /^\[보강\]\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s+보강 안내/.exec(noticeTitle);
  const date = legacy?.[2] ?? notice?.date ?? "";
  const timeMatch = notice?.content?.match(/📅 일시:\s*\d{4}-\d{2}-\d{2}\s+(\d{1,2}:\d{2})/);
  const time = timeMatch?.[1] ?? "";
  const labelMatch = notice?.content?.match(/📝\s*(.+)/);
  return {
    date,
    time,
    label: labelMatch?.[1]?.trim().split("\n")[0] ?? "보강 수업",
  };
}

export function noticeMakeupSignature(notice) {
  const meta = parseMakeupNoticeMeta(notice);
  return makeupNoticeSignature({ date: meta.date, time: meta.time, title: meta.label });
}

function isMakeupNoticeRecord(notice) {
  return /^\[보강\]/.test(notice?.title ?? "");
}

/** 보강 대상 학생마다 개별 공지 생성 */
export async function publishMakeupNotices({
  schedule,
  students = [],
  academyName,
  addNotice,
  existingNotices = [],
}) {
  const studentIds = schedule?.studentIds ?? [];
  if (schedule?.type !== "makeup" || !studentIds.length || !addNotice) return [];

  const created = [];
  for (const studentId of studentIds) {
    const student = students.find((s) => String(s.id) === String(studentId));
    if (!student) continue;

    const signature = makeupNoticeSignature({
      date: schedule.date,
      time: schedule.time,
      title: schedule.title,
    });
    const duplicate = existingNotices.some(
      (n) =>
        isMakeupNoticeRecord(n) &&
        String(n.studentId) === String(student.id) &&
        noticeMakeupSignature(n) === signature
    );
    if (duplicate) continue;

    const notice = await addNotice({
      title: makeupNoticeTitle(student.name, schedule.date, schedule.time),
      content: makeupNoticeContent({
        studentName: student.name,
        date: schedule.date,
        time: schedule.time,
        title: schedule.title,
        academyName,
      }),
      date: schedule.date,
      important: true,
      scope: "individual",
      studentId: student.id,
    });
    created.push(notice);
  }
  return created;
}
