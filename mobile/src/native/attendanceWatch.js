/**
 * 네이티브 레이어 출결 감시 — AppState 기반 백그라운드 폴링
 *
 * WebView JS가 멈추는 백그라운드 상태에서도 Supabase REST API를
 * 직접 호출해 새 출결 기록을 감지하고 로컬 알림을 발송합니다.
 */
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// ─── 감시 컨텍스트 ────────────────────────────────────────────
let watchCtx = null;      // { academyId, studentId, studentName }
let knownIds = new Set(); // 이미 알림 처리한 출결 ID
let pollTimer = null;
let appStateSub = null;

const STATUS_LABELS = { present: "출석", late: "지각", absent: "결석", makeup: "보강" };
const POLL_INTERVAL_MS = 30_000; // 30초

// ─── Supabase 자격증명 ────────────────────────────────────────
function getSupabaseCreds() {
  const extra = Constants.expoConfig?.extra ?? {};
  return {
    url: extra.supabaseUrl ?? "",
    anonKey: extra.supabaseAnonKey ?? "",
  };
}

// ─── 오늘 출결 조회 (REST API) ────────────────────────────────
async function fetchTodayAttendance() {
  if (!watchCtx) return [];
  const { url, anonKey } = getSupabaseCreds();
  if (!url || !anonKey) return [];

  // 로컬 시간 기준 날짜 (UTC 사용 시 자정 전후로 하루 오차 발생)
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  // authToken이 있으면 사용자 JWT로 RLS 통과, 없으면 anon key (폴백)
  const authHeader = watchCtx.authToken
    ? `Bearer ${watchCtx.authToken}`
    : `Bearer ${anonKey}`;

  const endpoint =
    `${url}/rest/v1/attendance` +
    `?academy_id=eq.${watchCtx.academyId}` +
    `&student_id=eq.${watchCtx.studentId}` +
    `&attendance_date=eq.${today}` +
    `&select=id,status,student_name,class_time`;

  try {
    const res = await fetch(endpoint, {
      headers: { apikey: anonKey, Authorization: authHeader },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ─── 새 출결 감지 → 알림 발송 ────────────────────────────────
async function checkAndNotify() {
  const records = await fetchTodayAttendance();
  for (const r of records) {
    const id = String(r.id);
    if (knownIds.has(id)) continue;
    knownIds.add(id);
    const name = r.student_name ?? watchCtx?.studentName ?? "";
    const label = STATUS_LABELS[r.status] ?? r.status;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${name} ${label}`,
          body: "출결이 처리되었습니다.",
          data: { type: "attendance" },
          sound: true,
          ...(Platform.OS === "android" ? { channelId: "attendance" } : {}),
        },
        trigger: null,
      });
    } catch { /* 알림 권한 없는 경우 무시 */ }
  }
}

// ─── 폴링 시작 / 중지 ────────────────────────────────────────
function startPoll() {
  if (pollTimer) return;
  checkAndNotify();
  pollTimer = setInterval(checkAndNotify, POLL_INTERVAL_MS);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── AppState 리스너 ─────────────────────────────────────────
function handleAppStateChange(nextState) {
  if (!watchCtx) return;
  if (nextState !== "active") {
    // 백그라운드/인액티브 → 네이티브 폴링 시작
    startPoll();
  } else {
    // 포그라운드 복귀 → 폴링 중지 (WebView가 담당)
    stopPoll();
    // 즉시 한 번 체크해 놓친 알림 처리
    checkAndNotify();
  }
}

// ─── 공개 API ────────────────────────────────────────────────

/**
 * WebView에서 학부모 로그인 완료 시 호출
 * @param {{ academyId: string, studentId: string, studentName: string }} ctx
 */
export function setupAttendanceWatch(ctx) {
  watchCtx = ctx;
  knownIds.clear();

  // 기존 리스너 제거 후 재등록
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  // 현재 상태 확인 후 초기 설정
  const current = AppState.currentState;
  if (current !== "active") {
    // 이미 백그라운드 상태 → 즉시 폴링 시작 후 리스너 등록
    startPoll();
    appStateSub = AppState.addEventListener("change", handleAppStateChange);
  } else {
    // 포그라운드 상태 → 기존 오늘치 출결을 시드한 뒤에 리스너 등록
    // 시드 완료 전 AppState 전환 시 knownIds가 비어 있어
    // 기존 출결 전부에 알림이 발송되는 레이스 컨디션 방지
    stopPoll();
    fetchTodayAttendance().then((records) => {
      records.forEach((r) => knownIds.add(String(r.id)));
      appStateSub = AppState.addEventListener("change", handleAppStateChange);
    });
  }
}

/** WebView에서 학부모 로그아웃 시 호출 */
export function clearAttendanceWatch() {
  watchCtx = null;
  knownIds.clear();
  stopPoll();
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}
