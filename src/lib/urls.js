/** 스토어·웹 배포 URL (실제 스토어 등록 후 ID만 교체) */
export const APP_URLS = {
  admin: {
    ios: "https://apps.apple.com/app/artlog-admin/id0000000000",
    android: "https://play.google.com/store/apps/details?id=kr.artmuse.artlog.admin",
    web: "https://admin.artmuse.kr",
  },
  parent: {
    ios: "https://youjh824-star.github.io/art_muse/",
    android: "https://youjh824-star.github.io/art_muse/",
    web: "https://youjh824-star.github.io/art_muse/",
  },
};

export function parentAppDownloadUrl(platform = "auto") {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (platform === "ios" || /iPhone|iPad|iPod/i.test(ua)) return APP_URLS.parent.ios;
  if (platform === "android" || /Android/i.test(ua)) return APP_URLS.parent.android;
  return APP_URLS.parent.web;
}

export function adminAppDownloadUrl(platform = "auto") {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (platform === "ios" || /iPhone|iPad|iPod/i.test(ua)) return APP_URLS.admin.ios;
  if (platform === "android" || /Android/i.test(ua)) return APP_URLS.admin.android;
  return APP_URLS.admin.web;
}

export function buildParentInviteMessage(code, studentName, academyName = "아트뮤즈") {
  const download = parentAppDownloadUrl();
  return `[${academyName}] ${studentName} 학부모님, 학부모 앱에 가입해 주세요.

1. 아래 링크에서 「ArtLog 학부모」 앱을 설치합니다
${download}

2. 앱 실행 후 초대 코드를 입력합니다
인증코드: ${code}

코드 유효기간 7일 · 1회 사용`;
}
