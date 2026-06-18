/**
 * 앱 전역 알림 함수 — artlog-demo.jsx의 AppAlertModal과 연결
 * React 컴포넌트 밖(hook, lib)에서도 커스텀 모달로 알림을 띄울 수 있도록 공유
 */
let _fn = (msg) => window.alert(msg); // App 마운트 전 폴백

export function showAlert(msg) {
  _fn(String(msg ?? ""));
}

/** App 컴포넌트에서 AppAlertModal setter와 연결 */
export function wireShowAlert(fn) {
  _fn = fn;
}
