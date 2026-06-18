/** 학생 출석부 Word(.docx) 내보내기 */

const DOW_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function recentAttendanceMonthKeys(count = 6, date = new Date()) {
  const months = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function formatAttendanceMonthLabel(monthKey) {
  const [y, m] = monthKey.split("-");
  return `${y}년 ${Number(m)}월`;
}

function statusMark(status) {
  if (status === "present") return "○";
  if (status === "late") return "△";
  if (status === "absent") return "×";
  return "";
}

function statusLabel(status) {
  if (status === "present") return "출석";
  if (status === "late") return "지각";
  if (status === "absent") return "결석";
  return "-";
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  const days = [];
  for (let d = 1; d <= count; d++) {
    const dateStr = `${monthKey}-${String(d).padStart(2, "0")}`;
    const dt = new Date(`${dateStr}T12:00:00`);
    days.push({
      day: d,
      dateStr,
      dow: DOW_CODES[dt.getDay()],
      dowKo: DOW_KO[dt.getDay()],
    });
  }
  return days;
}

function buildRecordLookup(records, monthKey) {
  const map = new Map();
  for (const r of records ?? []) {
    const date = String(r.attendance_date ?? r.date ?? "").slice(0, 10);
    if (!date.startsWith(monthKey)) continue;
    map.set(`${r.student_id}:${date}`, r.status);
  }
  return map;
}

function summarizeStudentMonth(studentId, records, monthKey) {
  const counts = { present: 0, late: 0, absent: 0 };
  for (const r of records ?? []) {
    if (r.student_id !== studentId) continue;
    const date = String(r.attendance_date ?? r.date ?? "").slice(0, 10);
    if (!date.startsWith(monthKey)) continue;
    if (r.status === "present") counts.present++;
    else if (r.status === "late") counts.late++;
    else if (r.status === "absent") counts.absent++;
  }
  const total = counts.present + counts.late + counts.absent;
  const rate = total > 0 ? Math.round((counts.present / total) * 100) : 0;
  return { ...counts, total, rate };
}

async function exportFileBlob(filename, blob, mimeType) {
  if (window.ArtlogNative?.exportFile) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const result = await window.ArtlogNative.exportFile({ filename, base64, mimeType });
    return { ok: true, method: "native", ...result, filename };
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { ok: true, method: "download", filename };
}

function attendanceRegisterFilename(academy, monthKey, student) {
  const date = new Date().toISOString().slice(0, 10);
  if (student?.name) {
    return `${student.name}_출석부_${monthKey}_${date}.docx`;
  }
  const academyName = (academy?.name ?? "학원").replace(/[\\/:*?"<>|]/g, "_");
  return `${academyName}_출석부_${monthKey}_${date}.docx`;
}

function buildRegisterRows(students, records, monthKey) {
  const days = daysInMonth(monthKey);
  const lookup = buildRecordLookup(records, monthKey);
  const sorted = [...(students ?? [])].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const rows = sorted.map((student, index) => {
    const dayMarks = days.map(({ dateStr, dow }) => {
      const scheduled = student.classDay?.includes(dow);
      if (!scheduled) return "—";
      const status = lookup.get(`${student.id}:${dateStr}`);
      return status ? statusMark(status) : "";
    });
    const summary = summarizeStudentMonth(student.id, records, monthKey);
    return {
      no: index + 1,
      name: student.name,
      grade: `${student.school ?? ""} ${student.grade ?? ""}`.trim(),
      classTime: student.classTime ?? "-",
      classDays: (student.classDay ?? []).map((d) => ({ MON: "월", TUE: "화", WED: "수", THU: "목", FRI: "금" }[d] ?? d)).join(","),
      dayMarks,
      ...summary,
    };
  });
  return { days, rows };
}

async function buildSingleStudentListDocx({ student, records, monthKey, academy }) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    PageOrientation,
    VerticalAlign,
    WidthType,
    HeadingLevel,
  } = await import("docx");

  const days = daysInMonth(monthKey);
  const lookup = buildRecordLookup(records, monthKey);
  const summary = summarizeStudentMonth(student.id, records, monthKey);

  const cell = (text, opts = {}) =>
    new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: opts.align ?? AlignmentType.CENTER,
          children: [new TextRun({ text: String(text ?? ""), bold: !!opts.bold, size: opts.size ?? 20 })],
        }),
      ],
    });

  const detailRows = [
    new TableRow({
      children: [cell("날짜", { bold: true }), cell("요일", { bold: true }), cell("상태", { bold: true }), cell("수업시간", { bold: true })],
    }),
  ];

  for (const { dateStr, dowKo } of days) {
    const dow = DOW_CODES[new Date(`${dateStr}T12:00:00`).getDay()];
    if (!student.classDay?.includes(dow)) continue;
    const status = lookup.get(`${student.id}:${dateStr}`);
    detailRows.push(
      new TableRow({
        children: [
          cell(dateStr, { align: AlignmentType.LEFT }),
          cell(`${dowKo}요일`),
          cell(status ? statusLabel(status) : "미기록"),
          cell(student.classTime ?? "-"),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.PORTRAIT } },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: `${student.name} 출석부`, bold: true, size: 40 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: `${academy?.name ?? ""} · ${formatAttendanceMonthLabel(monthKey)}`,
                size: 24,
                color: "8C7B72",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `출석 ${summary.present} · 지각 ${summary.late} · 결석 ${summary.absent} · 출석률 ${summary.total ? `${summary.rate}%` : "-"}`,
                size: 22,
                color: "C17F5B",
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: detailRows,
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function exportAttendanceRegisterDocx({
  students,
  attendanceRecords,
  academy,
  monthKey = currentMonthKey(),
}) {
  const list = students ?? [];
  if (!list.length) throw new Error("등록된 학생이 없습니다.");

  const { days, rows } = buildRegisterRows(list, attendanceRecords, monthKey);
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    PageOrientation,
    VerticalAlign,
    WidthType,
    HeadingLevel,
  } = await import("docx");

  const cell = (text, opts = {}) =>
    new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          alignment: opts.align ?? AlignmentType.CENTER,
          children: [new TextRun({ text: String(text ?? ""), bold: !!opts.bold, size: opts.size ?? 18 })],
        }),
      ],
    });

  const headerCells = [
    cell("No", { bold: true, size: 16 }),
    cell("이름", { bold: true, size: 16 }),
    cell("학년", { bold: true, size: 16 }),
    cell("시간", { bold: true, size: 16 }),
    ...days.map(({ day, dowKo }) => cell(`${day}\n${dowKo}`, { bold: true, size: 14 })),
    cell("출석", { bold: true, size: 16 }),
    cell("지각", { bold: true, size: 16 }),
    cell("결석", { bold: true, size: 16 }),
    cell("출석률", { bold: true, size: 16 }),
  ];

  const tableRows = [
    new TableRow({ children: headerCells }),
    ...rows.map((row) =>
      new TableRow({
        children: [
          cell(String(row.no), { size: 16 }),
          cell(row.name, { size: 16, align: AlignmentType.LEFT }),
          cell(row.grade, { size: 16, align: AlignmentType.LEFT }),
          cell(row.classTime, { size: 16 }),
          ...row.dayMarks.map((mark) => cell(mark, { size: 16 })),
          cell(String(row.present), { size: 16 }),
          cell(String(row.late), { size: 16 }),
          cell(String(row.absent), { size: 16 }),
          cell(row.total ? `${row.rate}%` : "-", { size: 16 }),
        ],
      })
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.LANDSCAPE } },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [new TextRun({ text: `${academy?.name ?? "학원"} 출석부`, bold: true, size: 44 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: formatAttendanceMonthLabel(monthKey), size: 28, color: "8C7B72" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: `생성일 ${new Date().toISOString().slice(0, 10)} · ○ 출석  △ 지각  × 결석  — 수업 없음`,
                size: 20,
                color: "8C7B72",
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = attendanceRegisterFilename(academy, monthKey);
  return exportFileBlob(
    filename,
    blob,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export async function exportStudentAttendanceDocx({
  student,
  attendanceRecords,
  academy,
  monthKey = currentMonthKey(),
}) {
  if (!student) throw new Error("학생 정보가 없습니다.");
  const blob = await buildSingleStudentListDocx({ student, records: attendanceRecords, monthKey, academy });
  const filename = attendanceRegisterFilename(academy, monthKey, student);
  return exportFileBlob(
    filename,
    blob,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function attendanceExportSuccessMessage(result) {
  const name = result?.filename || "출석부.docx";
  if (result?.method === "native" || result?.method === "download") {
    const isNative = !!window.ArtlogNative?.isNative;
    const where = isNative
      ? result?.path === "Download"
        ? "다운로드 폴더"
        : "앱 문서 폴더"
      : "다운로드";
    return `Word 출석부가 ${where}에 저장되었습니다.\n${name}`;
  }
  return `Word 출석부가 저장되었습니다.\n${name}`;
}
