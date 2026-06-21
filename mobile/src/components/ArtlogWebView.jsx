import { useEffect, useRef, useState, useCallback } from "react";
import { registerForPushNotifications } from "../native/notifications";
import { requestMediaPermissions } from "../native/media";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import {
  handleBridgeMessage,
  injectedBridgeScript,
  postBridgeResponse,
} from "../native/bridge";

function isEmbeddedWebMode() {
  const extra = Constants.expoConfig?.extra;
  if (extra?.useEmbeddedWeb === true) return true;
  // Release APK/AAB: bundled assets (not Vite dev server)
  if (!__DEV__ && (Platform.OS === "android" || Platform.OS === "ios")) {
    return true;
  }
  return false;
}

function resolveWebAppUrl() {
  const extra = Constants.expoConfig?.extra;
  const variant = extra?.appVariant === "parent" ? "parent" : "admin";
  const devPort = variant === "parent" ? 5175 : 5174;

  if (isEmbeddedWebMode()) {
    if (Platform.OS === "android") {
      return "file:///android_asset/web/index.html";
    }
    if (Platform.OS === "ios") {
      return `${FileSystem.bundleDirectory}web/index.html`;
    }
  }

  const configured =
    extra?.webAppUrl ??
    process.env.EXPO_PUBLIC_WEB_APP_URL ??
    `http://localhost:${devPort}`;
  // 10.0.2.2 = 에뮬레이터 전용. USB adb reverse 는 127.0.0.1 유지
  if (
    Platform.OS === "android" &&
    configured.includes("localhost") &&
    !Constants.isDevice
  ) {
    return configured.replace("localhost", "10.0.2.2");
  }
  return configured;
}

function webAppHint(useEmbedded) {
  if (useEmbedded) return "앱 내장 웹앱";
  return resolveWebAppUrl();
}

export default function ArtlogWebView() {
  const webRef = useRef(null);
  const pushTokenRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const useEmbedded = isEmbeddedWebMode();
  const webAppUrl = resolveWebAppUrl();

  const injectPushToken = useCallback((token) => {
    if (!token || !webRef.current) return;
    webRef.current.injectJavaScript(
      `window.__nativePushToken = ${JSON.stringify(token)};
       window.dispatchEvent(new CustomEvent('nativePushToken', { detail: ${JSON.stringify(token)} }));
       true;`
    );
  }, []);

  useEffect(() => {
    registerForPushNotifications()
      .then((token) => {
        if (!token) return;
        pushTokenRef.current = token;
        injectPushToken(token);
      })
      .catch((e) => console.warn("Push registration:", e.message));
    requestMediaPermissions().catch(() => {});
  }, [injectPushToken]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!webRef.current) return false;
      webRef.current.injectJavaScript(
        `window.dispatchEvent(new CustomEvent('artlog-back')); true;`
      );
      return true;
    });
    return () => sub.remove();
  }, []);

  const onMessage = async (event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      await handleBridgeMessage(message, (response) =>
        postBridgeResponse(webRef, response)
      );
    } catch (e) {
      console.warn("Bridge parse error", e);
    }
  };

  if (error) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>웹앱 연결 실패</Text>
        <Text style={styles.errorUrl}>{webAppHint(useEmbedded)}</Text>
        <Text style={styles.errorMsg}>{error}</Text>
        <Text style={styles.errorHint}>
          {useEmbedded
            ? "앱을 다시 설치하거나 npm run bundle:web 후 재빌드하세요."
            : "폰 브라우저에서 위 URL이 열리는지 확인하세요.\nVite(npm run dev)가 켜져 있어야 합니다."}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setError(null); setLoading(true); webRef.current?.reload(); }}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#C17F5B" />
          <Text style={styles.loadingText}>웹앱 연결 중…</Text>
          <Text style={styles.urlHint}>{webAppHint(useEmbedded)}</Text>
        </View>
      )}
      <WebView
        ref={webRef}
        source={{ uri: webAppUrl }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={injectedBridgeScript}
        injectedJavaScript={injectedBridgeScript}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={["*"]}
        mixedContentMode="always"
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        setSupportMultipleWindows={false}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          if (pushTokenRef.current) injectPushToken(pushTokenRef.current);
        }}
        onError={(e) => setError(e.nativeEvent.description ?? "WebView 오류")}
        onHttpError={(e) =>
          setError(`HTTP ${e.nativeEvent.statusCode} — Vite 서버 확인`)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF7F2" },
  webview: { flex: 1 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAF7F2",
    zIndex: 1,
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#8C7B72" },
  urlHint: { marginTop: 8, fontSize: 11, color: "#C17F5B" },
  errorWrap: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: "#FAF7F2" },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#3D3530", marginBottom: 8 },
  errorUrl: { fontSize: 12, color: "#C17F5B", marginBottom: 12 },
  errorMsg: { fontSize: 13, color: "#8C7B72", marginBottom: 16 },
  errorHint: { fontSize: 12, color: "#8C7B72", lineHeight: 18 },
  retryBtn: { marginTop: 20, backgroundColor: "#C17F5B", padding: 14, borderRadius: 12, alignItems: "center" },
  retryText: { color: "#fff", fontWeight: "700" },
});
