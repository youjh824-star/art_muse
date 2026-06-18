/** 기본 학생 프로필 이미지 (public/student-default-avatar.png) */
export const DEFAULT_STUDENT_AVATAR_URL = `${import.meta.env.BASE_URL}student-default-avatar.png`;

let defaultAvatarDataUriCache = null;

export function genderLabel(gender) {
  if (gender === "male") return "남자";
  if (gender === "female") return "여자";
  return "-";
}

/** 아이콘·사진 미선택 시 기본 이미지 data URI (Storage 업로드용)
 *  file:// 내장 웹앱 환경에서 fetch 실패 시 null 반환 (업로드 스킵) */
export async function loadDefaultStudentAvatarDataUri() {
  if (defaultAvatarDataUriCache) return defaultAvatarDataUriCache;
  try {
    const res = await fetch(DEFAULT_STUDENT_AVATAR_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    defaultAvatarDataUriCache = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return defaultAvatarDataUriCache;
  } catch {
    // file:// 환경(내장 APK)에서 로컬 파일 fetch 불가 — 기본 아바타 업로드 스킵
    return null;
  }
}

/** UI 표시용 아바타 소스 */
export function getStudentAvatarSrc(student) {
  if (student?.photoUri) return student.photoUri;
  if (student?.useEmojiAvatar && student?.art) return null;
  return DEFAULT_STUDENT_AVATAR_URL;
}

export function shouldShowStudentEmoji(student) {
  return !student?.photoUri && !!student?.useEmojiAvatar && !!student?.art;
}
