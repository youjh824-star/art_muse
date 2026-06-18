/** 포트폴리오 PDF/Word 내보내기 — 피드백 요약 포함 */

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeTitle(title) {
  return String(title ?? "").trim().toLowerCase();
}

function daysBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity;
  return Math.abs(Math.round((da - db) / 86400000));
}

const PLACEHOLDER_DESCRIPTIONS = new Set([
  "업로드된 작품 사진입니다.",
  "업로드된 작품입니다.",
  "학부모가 집에서 완성한 작품입니다.",
]);

/** 포트폴리오에 넣을 작품 설명 — 자동 생성 placeholder는 제외 */
export function portfolioArtDescription(desc) {
  const text = String(desc ?? "").trim();
  if (!text || PLACEHOLDER_DESCRIPTIONS.has(text)) return "";
  return text;
}

/** 피드백 본문을 포트폴리오용 짧은 요약으로 변환 */
export function summarizeFeedbackText(content, maxLen = 160) {
  if (!content?.trim()) return "";
  const normalized = content.replace(/\s+/g, " ").trim();
  const sentences = normalized
    .split(/(?<=[.!?…])\s+|(?<=다\.)\s+|(?<=요\.)\s+|(?<=니다\.)\s+/)
    .filter(Boolean);
  let summary = sentences.slice(0, 2).join(" ");
  if (summary.length > maxLen) {
    summary = normalized.slice(0, maxLen).trim();
    if (summary.length < normalized.length) summary += "…";
  } else if (sentences.length > 2) {
    summary += " …";
  }
  return summary;
}

export function findFeedbacksForArt(art, feedbacks, studentName, studentId) {
  const title = normalizeTitle(art.title);
  return feedbacks
    .filter((f) => {
      const sameStudent =
        (studentId && f.studentId === studentId) ||
        f.studentName === studentName ||
        f.studentName === art.studentName;
      if (!sameStudent) return false;
      if (f.artwork && normalizeTitle(f.artwork) === title) return true;
      return false;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getArtFeedbackSummary(art, feedbacks, student) {
  const matched = findFeedbacksForArt(art, feedbacks, student.name, student.id);
  if (matched.length) {
    return summarizeFeedbackText(matched.map((f) => f.content).join(" "));
  }
  const nearby = feedbacks
    .filter((f) => {
      const sameStudent =
        (student.id && f.studentId === student.id) || f.studentName === student.name;
      return sameStudent && daysBetween(f.date, art.date) <= 14;
    })
    .sort((a, b) => daysBetween(a.date, art.date) - daysBetween(b.date, art.date));
  if (nearby.length) return summarizeFeedbackText(nearby[0].content);
  return "";
}

export function getStudentPortfolioArts(student, artworks, feedbacks = []) {
  return artworks
    .filter((a) => a.studentId === student.id)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((art) => ({
      ...art,
      feedbackSummary: getArtFeedbackSummary(art, feedbacks, student),
    }));
}

export function portfolioFilename(student, ext) {
  const date = new Date().toISOString().slice(0, 10);
  return `${student.name}_포트폴리오_${date}.${ext}`;
}

export function renderPortfolioCover({ student, academy }) {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center">
      <div style="font-size:14px;color:#8C7B72;margin-bottom:24px">${escHtml(academy.name)}</div>
      <div style="font-size:56px;margin-bottom:16px">${student.art}</div>
      <div style="font-size:32px;font-weight:800;margin-bottom:8px">${escHtml(student.name)}</div>
      <div style="font-size:16px;color:#8C7B72">${escHtml(student.school)} · ${escHtml(student.grade)}</div>
      <div style="margin-top:48px;font-size:18px;font-weight:700;color:#C17F5B">작품 포트폴리오</div>
      <div style="font-size:12px;color:#8C7B72;margin-top:8px">${today}</div>
    </div>`;
}

export function renderPortfolioArtPage({ art }) {
  const imgBlock = art.photoUri
    ? `<img src="${art.photoUri}" crossorigin="anonymous" style="width:100%;max-height:420px;object-fit:contain;border-radius:12px;background:#F0EBE3"/>`
    : `<div style="height:260px;display:flex;align-items:center;justify-content:center;font-size:120px;background:linear-gradient(135deg,#F0EBE3,#E8DDD0);border-radius:12px">${art.emoji}</div>`;
  const homeBadge =
    art.uploadedBy === "parent"
      ? `<span style="display:inline-block;background:#E8F4EA;color:#7A9E7E;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600">집에서 완성</span>`
      : "";
  const fbBlock = art.feedbackSummary
    ? `<div style="margin-top:12px;font-size:12px;line-height:1.7;color:#3D3530;background:#F5F0EA;border-radius:12px;padding:14px"><div style="font-size:11px;font-weight:700;color:#C17F5B;margin-bottom:6px">💬 선생님 피드백</div>${escHtml(art.feedbackSummary)}</div>`
    : "";
  const desc = portfolioArtDescription(art.desc);
  const descBlock = desc
    ? `<div style="font-size:13px;line-height:1.8;color:#3D3530;background:white;border-radius:12px;padding:16px">${escHtml(desc)}</div>`
    : "";
  return `
    <div style="height:100%;display:flex;flex-direction:column">
      <div style="font-size:22px;font-weight:800;margin-bottom:6px">${escHtml(art.title)} ${homeBadge}</div>
      <div style="font-size:13px;color:#8C7B72;margin-bottom:16px">${escHtml(art.medium)} · ${escHtml(art.date)} · 완성 ${art.progress}%</div>
      <div style="flex:1;display:flex;align-items:center;justify-content:center;margin-bottom:16px">${imgBlock}</div>
      ${descBlock}
      ${fbBlock}
    </div>`;
}

async function resolveImageForExport(url) {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function parseDataUri(dataUri) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function prepareArtsForExport(arts) {
  return Promise.all(
    arts.map(async (art) => ({
      ...art,
      photoUri: art.photoUri ? await resolveImageForExport(art.photoUri) : null,
    }))
  );
}

async function exportPdfBlob(filename, blob) {
  if (window.ArtlogNative?.exportPdf) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const result = await window.ArtlogNative.exportPdf({ filename, base64 });
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

async function waitForImages(el) {
  const imgs = el.querySelectorAll("img");
  await Promise.all(
    [...imgs].map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = resolve;
          img.onerror = resolve;
        })
    )
  );
}

export async function exportStudentPortfolioPdf({ student, artworks, academy, feedbacks = [] }) {
  const arts = await prepareArtsForExport(getStudentPortfolioArts(student, artworks, feedbacks));
  if (!arts.length) throw new Error("저장할 작품이 없습니다.");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = [{ type: "cover", student, academy }, ...arts.map((art) => ({ type: "art", art }))];

  for (let i = 0; i < pages.length; i++) {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:-10000px;top:0;width:794px;height:1123px;padding:48px;box-sizing:border-box;background:#FAF7F2;font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#3D3530";
    el.innerHTML =
      pages[i].type === "cover"
        ? renderPortfolioCover(pages[i])
        : renderPortfolioArtPage(pages[i]);
    document.body.appendChild(el);
    await waitForImages(el);
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#FAF7F2",
    });
    document.body.removeChild(el);
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) doc.addPage();
    doc.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
  }

  const blob = doc.output("blob");
  const filename = portfolioFilename(student, "pdf");
  return exportPdfBlob(filename, blob);
}

async function fetchImageForDocx(url) {
  const src = await resolveImageForExport(url);
  if (!src) return null;
  if (src.startsWith("data:")) {
    const parsed = parseDataUri(src);
    if (!parsed) return null;
    const lower = parsed.mime.toLowerCase();
    let type = "jpg";
    if (lower.includes("png")) type = "png";
    else if (lower.includes("gif")) type = "gif";
    else if (lower.includes("bmp")) type = "bmp";
    else if (lower.includes("webp")) return null;
    return { data: base64ToArrayBuffer(parsed.base64), type };
  }
  return null;
}

export async function exportStudentPortfolioDocx({ student, artworks, academy, feedbacks = [] }) {
  const arts = await prepareArtsForExport(getStudentPortfolioArts(student, artworks, feedbacks));
  if (!arts.length) throw new Error("저장할 작품이 없습니다.");

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    HeadingLevel,
    AlignmentType,
    PageBreak,
  } = await import("docx");

  const today = new Date().toISOString().slice(0, 10);
  const coverChildren = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: academy?.name ?? "", size: 22, color: "8C7B72" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: student.art ?? "🎨", size: 72 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: student.name, bold: true, size: 48 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `${student.school ?? ""} · ${student.grade ?? ""}`,
          size: 24,
          color: "8C7B72",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "작품 포트폴리오", bold: true, size: 32, color: "C17F5B" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: today, size: 20, color: "8C7B72" })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const artSections = [];
  for (let i = 0; i < arts.length; i++) {
    const art = arts[i];
    const section = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
        children: [new TextRun({ text: art.title, bold: true })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `${art.medium} · ${art.date} · 완성 ${art.progress}%${
              art.uploadedBy === "parent" ? " · 집에서 완성" : ""
            }`,
            color: "8C7B72",
            size: 20,
          }),
        ],
      }),
    ];

    const img = await fetchImageForDocx(art.photoUri);
    if (img) {
      section.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new ImageRun({
              data: img.data,
              type: img.type,
              transformation: { width: 420, height: 315 },
            }),
          ],
        })
      );
    } else {
      section.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: art.emoji ?? "🎨", size: 96 })],
        })
      );
    }

    const desc = portfolioArtDescription(art.desc);
    if (desc) {
      section.push(
        new Paragraph({
          spacing: { after: 160 },
          children: [new TextRun({ text: desc, size: 22 })],
        })
      );
    }

    if (art.feedbackSummary) {
      section.push(
        new Paragraph({
          spacing: { before: 120, after: 80 },
          children: [new TextRun({ text: "💬 선생님 피드백", bold: true, size: 22, color: "C17F5B" })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: art.feedbackSummary, size: 22 })],
        })
      );
    }

    if (i < arts.length - 1) {
      section.push(new Paragraph({ children: [new PageBreak()] }));
    }
    artSections.push(...section);
  }

  const doc = new Document({
    sections: [{ properties: {}, children: [...coverChildren, ...artSections] }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = portfolioFilename(student, "docx");
  return exportFileBlob(
    filename,
    blob,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export function portfolioExportSuccessMessage(result, format) {
  const name = result?.filename || `${format === "docx" ? "Word" : "PDF"} 포트폴리오`;
  const label = format === "docx" ? "Word" : "PDF";
  if (result?.method === "native" || result?.method === "download") {
    const isNative = !!window.ArtlogNative?.isNative;
    const where = isNative
      ? result?.path === "Download"
        ? "다운로드 폴더"
        : "앱 문서 폴더"
      : "다운로드";
    return `${label} 파일이 ${where}에 저장되었습니다.\n${name}`;
  }
  return `${label} 파일이 저장되었습니다.\n${name}`;
}
