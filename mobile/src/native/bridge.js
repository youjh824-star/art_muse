import { BackHandler, Platform } from "react-native";
import { takeArtworkPhoto, pickArtworkFromGallery } from "./media";
import { notifyAttendance, notifyFeedback, notifyFeedbackReceived, notifyFeeReminder, notifyUnpaidReminder, notifyMakeup, notifyNotice } from "./notifications";
import { generateParentFeedback } from "./openai";
import { exportBackupJson, exportPortfolioPdf, exportPortfolioFile } from "./export";
import { setupAttendanceWatch, clearAttendanceWatch } from "./attendanceWatch";

/** WebView ↔ React Native 메시지 타입 */
export const BRIDGE_ACTIONS = {
  OPEN_CAMERA: "OPEN_CAMERA",
  OPEN_GALLERY: "OPEN_GALLERY",
  NOTIFY_ATTENDANCE: "NOTIFY_ATTENDANCE",
  NOTIFY_FEEDBACK: "NOTIFY_FEEDBACK",
  NOTIFY_FEE_REMINDER: "NOTIFY_FEE_REMINDER",
  NOTIFY_UNPAID_REMINDER: "NOTIFY_UNPAID_REMINDER",
  GENERATE_AI_FEEDBACK: "GENERATE_AI_FEEDBACK",
  EXPORT_BACKUP: "EXPORT_BACKUP",
  EXPORT_PDF: "EXPORT_PDF",
  EXPORT_FILE: "EXPORT_FILE",
  NOTIFY_FEEDBACK_RECEIVED: "NOTIFY_FEEDBACK_RECEIVED",
  NOTIFY_NOTICE: "NOTIFY_NOTICE",
  NOTIFY_MAKEUP: "NOTIFY_MAKEUP",
  EXIT_APP: "EXIT_APP",
  NATIVE_READY: "NATIVE_READY",
  SETUP_ATTENDANCE_WATCH: "SETUP_ATTENDANCE_WATCH",
  CLEAR_ATTENDANCE_WATCH: "CLEAR_ATTENDANCE_WATCH",
};

/** WebView에서 온 메시지 처리 */
export async function handleBridgeMessage(message, postToWeb) {
  const { action, payload, requestId } = message;

  try {
    let result = null;

    switch (action) {
      case BRIDGE_ACTIONS.OPEN_CAMERA:
        result = await takeArtworkPhoto();
        break;
      case BRIDGE_ACTIONS.OPEN_GALLERY:
        result = await pickArtworkFromGallery();
        break;
      case BRIDGE_ACTIONS.NOTIFY_ATTENDANCE:
        await notifyAttendance(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.NOTIFY_FEEDBACK:
        await notifyFeedback(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.NOTIFY_FEEDBACK_RECEIVED:
        await notifyFeedbackReceived(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.NOTIFY_NOTICE:
        await notifyNotice(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.NOTIFY_FEE_REMINDER:
        await notifyFeeReminder(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.NOTIFY_UNPAID_REMINDER:
        await notifyUnpaidReminder(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.NOTIFY_MAKEUP:
        await notifyMakeup(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.GENERATE_AI_FEEDBACK:
        result = { text: await generateParentFeedback(payload?.prompt) };
        break;
      case BRIDGE_ACTIONS.EXPORT_BACKUP:
        await exportBackupJson(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.EXPORT_PDF:
        result = await exportPortfolioPdf(payload);
        break;
      case BRIDGE_ACTIONS.EXPORT_FILE:
        result = await exportPortfolioFile(payload);
        break;
      case BRIDGE_ACTIONS.SETUP_ATTENDANCE_WATCH:
        setupAttendanceWatch(payload);
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.CLEAR_ATTENDANCE_WATCH:
        clearAttendanceWatch();
        result = { ok: true };
        break;
      case BRIDGE_ACTIONS.EXIT_APP:
        if (Platform.OS === "android") BackHandler.exitApp();
        result = { ok: true };
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    postToWeb({ requestId, success: true, data: result });
  } catch (err) {
    postToWeb({
      requestId,
      success: false,
      error: err.message ?? "Native action failed",
    });
  }
}

/** WebView에 주입할 JS — window.ArtlogNative API 생성 */
export const injectedBridgeScript = `
(function() {
  if (window.ArtlogNative) return;
  var pending = {};
  var reqId = 0;
  function onBridgeReply(e) {
    try {
      var raw = e.data;
      if (typeof raw !== 'string') return;
      var msg = JSON.parse(raw);
      if (!msg.requestId || !pending[msg.requestId]) return;
      var p = pending[msg.requestId];
      delete pending[msg.requestId];
      if (msg.success) p.resolve(msg.data);
      else p.reject(new Error(msg.error || 'Failed'));
    } catch(err) {}
  }
  window.addEventListener('message', onBridgeReply);
  document.addEventListener('message', onBridgeReply);
  window.ArtlogNative = {
    isNative: true,
    _post: function(action, payload) {
      return new Promise(function(resolve, reject) {
        var id = 'req_' + (++reqId);
        pending[id] = { resolve: resolve, reject: reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({
          action: action,
          payload: payload || {},
          requestId: id
        }));
      });
    },
    openCamera: function() { return this._post('OPEN_CAMERA'); },
    openGallery: function() { return this._post('OPEN_GALLERY'); },
    notifyAttendance: function(p) { return this._post('NOTIFY_ATTENDANCE', p); },
    notifyFeedback: function(p) { return this._post('NOTIFY_FEEDBACK', p); },
    notifyFeedbackReceived: function(p) { return this._post('NOTIFY_FEEDBACK_RECEIVED', p); },
    notifyNotice: function(p) { return this._post('NOTIFY_NOTICE', p); },
    notifyFeeReminder: function(p) { return this._post('NOTIFY_FEE_REMINDER', p); },
    notifyUnpaidReminder: function(p) { return this._post('NOTIFY_UNPAID_REMINDER', p); },
    notifyMakeup: function(p) { return this._post('NOTIFY_MAKEUP', p); },
    generateFeedback: function(p) { return this._post('GENERATE_AI_FEEDBACK', p); },
    exportBackup: function(p) { return this._post('EXPORT_BACKUP', p); },
    exportPdf: function(p) { return this._post('EXPORT_PDF', p); },
    exportFile: function(p) { return this._post('EXPORT_FILE', p); },
    exitApp: function() { return this._post('EXIT_APP', {}); },
    setupAttendanceWatch: function(p) { return this._post('SETUP_ATTENDANCE_WATCH', p); },
    clearAttendanceWatch: function() { return this._post('CLEAR_ATTENDANCE_WATCH', {}); }
  };
  document.dispatchEvent(new Event('artlog-native-ready'));
})();
true;
`;

/** WebView → RN 응답 (postMessage — base64 등 대용량 payload 지원) */
export function postBridgeResponse(webViewRef, response) {
  webViewRef.current?.postMessage(JSON.stringify(response));
}
