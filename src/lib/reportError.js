import { dbErrorMessage } from "./authErrors.js";
import { showAlert } from "./showAlert.js";

/** 백그라운드 작업 실패 — 개발 콘솔에만 기록 */
export function logBackgroundError(label, err) {
  const msg = err?.message ?? String(err ?? "");
  if (import.meta.env?.DEV) {
    console.warn(`[ArtLog] ${label}:`, msg);
  }
}

/** 사용자 액션 실패 — 커스텀 모달로 표시 */
export function alertMutationError(err, fallback = "저장에 실패했습니다.") {
  showAlert(dbErrorMessage(err) || fallback);
}

/** Promise rejection을 alert로 처리 (fire-and-forget용) */
export function catchUserAction(err, fallback) {
  alertMutationError(err, fallback);
}
