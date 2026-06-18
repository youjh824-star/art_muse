const fs = require("fs");
const path = require("path");
const { load: loadEnv } = require("@expo/env");

loadEnv(path.resolve(__dirname));

const VARIANTS = {
  admin: {
    name: "ArtLog 원장",
    scheme: "artlog-admin",
    bundleIdentifier: "kr.artmuse.artlog.admin",
    package: "kr.artmuse.artlog.admin",
    embeddedWebSrc: "embedded-web-admin",
    icon: "./assets/icon-admin-padded.png",
    adaptiveIcon: "./assets/icon-admin-padded.png",
  },
  parent: {
    name: "ArtLog 학부모",
    scheme: "artlog-parent",
    bundleIdentifier: "kr.artmuse.artlog.parent",
    package: "kr.artmuse.artlog.parent",
    embeddedWebSrc: "embedded-web-parent",
    icon: "./assets/icon-parent-padded.png",
    adaptiveIcon: "./assets/icon-parent-padded.png",
  },
};

/** EAS 프로젝트 slug — admin/parent는 bundle ID로 구분, Expo slug는 하나로 유지 */
const EAS_SLUG = process.env.EAS_PROJECT_SLUG || "artlog";

const variantKey = process.env.APP_VARIANT === "parent" ? "parent" : "admin";
const variant = VARIANTS[variantKey];

function resolveGoogleServicesFile() {
  const configured = process.env.GOOGLE_SERVICES_JSON;
  if (!configured) return undefined;
  const resolved = path.isAbsolute(configured)
    ? configured
    : path.resolve(__dirname, configured);
  return fs.existsSync(resolved) ? resolved : undefined;
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = () => ({
  expo: {
    name: variant.name,
    slug: EAS_SLUG,
    version: "1.0.0",
    orientation: "portrait",
    icon: variant.icon ?? "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: variant.scheme,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FAF7F2",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: variant.bundleIdentifier,
      buildNumber: "1",
      infoPlist: {
        NSCameraUsageDescription:
          "ArtLog은 학생 작품 사진을 촬영하기 위해 카메라 접근이 필요합니다.",
        NSPhotoLibraryUsageDescription:
          "ArtLog은 갤러리에서 작품 사진을 선택하기 위해 사진 접근이 필요합니다.",
        NSPhotoLibraryAddUsageDescription:
          "ArtLog은 촬영한 작품을 저장하기 위해 사진 보관함 접근이 필요합니다.",
        UIBackgroundModes: ["remote-notification"],
      },
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      package: variant.package,
      versionCode: 1,
      usesCleartextTraffic: process.env.USE_EMBEDDED_WEB === "1",
      adaptiveIcon: {
        foregroundImage: variant.adaptiveIcon ?? "./assets/adaptive-icon.png",
        backgroundColor: "#FAF7F2",
      },
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.VIBRATE",
        "android.permission.POST_NOTIFICATIONS",
      ],
      googleServicesFile: resolveGoogleServicesFile(),
    },
    plugins: [
      "expo-asset",
      [
        "expo-camera",
        {
          cameraPermission:
            "ArtLog은 학생 작품 사진을 촬영하기 위해 카메라 접근이 필요합니다.",
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "ArtLog은 갤러리에서 작품 사진을 선택하기 위해 사진 접근이 필요합니다.",
          cameraPermission:
            "ArtLog은 학생 작품 사진을 촬영하기 위해 카메라 접근이 필요합니다.",
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#C17F5B",
          defaultChannel: "default",
          sounds: [],
        },
      ],
      "./plugins/withEmbeddedWeb.js",
    ],
    extra: {
      eas: {
        projectId:
          process.env.EAS_PROJECT_ID ??
          "4b3ec554-e483-498e-b221-03f918005550",
      },
      appVariant: variantKey,
      webAppUrl:
        process.env.EXPO_PUBLIC_WEB_APP_URL ?? "http://localhost:5174",
      useEmbeddedWeb:
        process.env.USE_EMBEDDED_WEB === "1" ||
        process.env.NODE_ENV === "production",
      // openaiApiKey: APK 소스에 포함하지 않음 — Supabase Edge Function(openai-proxy)에서 처리
      openaiModel: process.env.EXPO_PUBLIC_OPENAI_MODEL ?? "gpt-4o-mini",
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
    },
  },
});
