import Constants from "expo-constants";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

/** Expo Go(SDK 53+)에서는 원격 푸시 토큰 미지원 — 로컬 알림만 사용 */
function isExpoGo() {
  return (
    Constants.executionEnvironment === "storeClient" ||
    Constants.appOwnership === "expo"
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** 푸시 알림 권한 요청 + Expo Push Token 발급 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn("푸시 알림은 실제 기기에서만 동작합니다.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "ArtLog 알림",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#C17F5B",
    });
    await Notifications.setNotificationChannelAsync("attendance", {
      name: "출결 알림",
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync("feedback", {
      name: "피드백 알림",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("푸시 알림 권한 없음 — 로컬 알림만 사용");
    return null;
  }

  if (isExpoGo()) {
    console.log("Expo Go — 로컬 알림만 사용 (원격 푸시는 preview APK에서 지원)");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

  if (!projectId || projectId === PLACEHOLDER) {
    console.warn("EAS projectId 미설정 — Expo Push Token 생략 (로컬 알림은 동작)");
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e) {
    console.warn("Push token:", e.message);
    return null;
  }
}

function channelForType(type) {
  if (type === "attendance") return "attendance";
  if (type === "feedback") return "feedback";
  if (type === "makeup") return "default";
  return "default";
}

/** 로컬 알림 (Expo Go·데모 — 출결·피드백 시 즉시 표시) */
export async function sendLocalNotification({ title, body, data = {} }) {
  const channelId = channelForType(data.type);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
    trigger: null,
  });
}

/** 일반·중요 공지 알림 (학부모) */
export async function notifyNotice({ title, important }) {
  await sendLocalNotification({
    title: important ? `📢 중요 공지: ${title}` : `📢 새 공지사항`,
    body: important ? "중요 공지가 등록되었습니다. 확인해 주세요." : title,
    data: { type: "notice", important: !!important },
  });
}

/** 보강 일정 안내 (학부모) */
export async function notifyMakeup({ studentName, date, time, title, body }) {
  await sendLocalNotification({
    title: `${studentName} 보강 안내`,
    body: body ?? `${date} ${time} · ${title || "보강 수업"}`,
    data: { type: "makeup", studentName, date, time, title },
  });
}

/** 출결 처리 후 학부모 알림 (데모) */
export async function notifyAttendance({ studentName, status }) {
  const labels = { present: "출석", late: "지각", absent: "결석", makeup: "보강" };
  await sendLocalNotification({
    title: `${studentName} ${labels[status] ?? status}`,
    body: "아트뮤즈에서 출결 처리되었습니다.",
    data: { type: "attendance", studentName, status },
  });
}

/** 피드백 수신 알림 — 학부모 기기에서 새 피드백 도착 시 */
export async function notifyFeedbackReceived({ studentName }) {
  await sendLocalNotification({
    title: "새 피드백이 도착했습니다",
    body: `${studentName} 학생의 선생님 피드백을 확인해 보세요.`,
    data: { type: "feedback", studentName },
  });
}

/** 피드백 발송 확인 알림 — 원장 기기 전용 (예약 발송 시) */
export async function notifyFeedback({ studentName, scheduledAt }) {
  const title = "새 피드백 도착";
  const body = `${studentName} 학부모님께 피드백이 발송되었습니다.`;

  if (scheduledAt) {
    const triggerDate = new Date(scheduledAt);
    if (!Number.isNaN(triggerDate.getTime()) && triggerDate.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "feedback", studentName },
          sound: true,
          ...(Platform.OS === "android" ? { channelId: "feedback" } : {}),
        },
        trigger: { date: triggerDate },
      });
      return;
    }
  }

  await sendLocalNotification({
    title,
    body,
    data: { type: "feedback", studentName },
  });
}

/** 수강료 미납 알림 (원장 → 학부모) */
export async function notifyUnpaidReminder({ studentName, amount, feeDueDay }) {
  await sendLocalNotification({
    title: "수강료 미납 안내",
    body: `${studentName} · ${amount?.toLocaleString?.() ?? amount}원 · 매월 ${feeDueDay}일 납부`,
    data: { type: "unpaid", studentName },
  });
}

/** 수강료 납부 임박 알림 (학부모) */
export async function notifyFeeReminder({ studentName, daysLeft, amount, dueDate }) {
  const title = daysLeft === 0 ? "오늘 수강료 납부일" : `수강료 납부 D-${daysLeft}`;
  await sendLocalNotification({
    title,
    body: `${studentName} · ${amount?.toLocaleString?.() ?? amount}원 · ${dueDate}`,
    data: { type: "payment", studentName, daysLeft },
  });
}
