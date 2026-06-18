import { requireSupabase } from "./supabase.js";

const BUCKET = "artworks";

function parseDataUri(dataUri) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUri);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function extFromMime(mime) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/** data URI 또는 http URL → Storage 업로드 후 public URL 반환 */
export async function uploadArtworkPhoto({ academyId, studentId, dataUri }) {
  if (!dataUri) return { photoUrl: null, photoPath: null };
  if (dataUri.startsWith("http")) {
    return { photoUrl: dataUri, photoPath: null };
  }

  const parsed = parseDataUri(dataUri);
  if (!parsed) throw new Error("지원하지 않는 이미지 형식입니다.");

  const sb = requireSupabase();
  const ext = extFromMime(parsed.mime);
  const path = `${academyId}/${studentId}/${Date.now()}.${ext}`;
  const body = base64ToUint8Array(parsed.base64);

  const { error } = await sb.storage.from(BUCKET).upload(path, body, {
    contentType: parsed.mime,
    upsert: false,
  });
  if (error) throw error;

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { photoUrl: data.publicUrl, photoPath: path };
}

/** 학생 프로필 사진 업로드 */
export async function uploadStudentPhoto({ academyId, studentId, dataUri }) {
  if (!dataUri) return { photoUrl: null, photoPath: null };
  if (dataUri.startsWith("http")) {
    return { photoUrl: dataUri, photoPath: null };
  }

  const parsed = parseDataUri(dataUri);
  if (!parsed) throw new Error("지원하지 않는 이미지 형식입니다.");

  const sb = requireSupabase();
  const ext = extFromMime(parsed.mime);
  const path = `${academyId}/students/${studentId}/avatar-${Date.now()}.${ext}`;
  const body = base64ToUint8Array(parsed.base64);

  const { error } = await sb.storage.from(BUCKET).upload(path, body, {
    contentType: parsed.mime,
    upsert: true,
  });
  if (error) throw error;

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { photoUrl: data.publicUrl, photoPath: path };
}

export async function uploadAcademyLogo({ academyId, dataUri }) {
  if (!dataUri || dataUri.startsWith("http")) return dataUri;
  const parsed = parseDataUri(dataUri);
  if (!parsed) return null;

  const sb = requireSupabase();
  const path = `${academyId}/logo.${extFromMime(parsed.mime)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, base64ToUint8Array(parsed.base64), {
    contentType: parsed.mime,
    upsert: true,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
