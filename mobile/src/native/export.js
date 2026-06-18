import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

/** JSON 백업 파일을 캐시에 저장 후 OS 공유 시트로 내보내기 */
export async function exportBackupJson({ filename, json }) {
  const safeName = filename.replace(/[^\w.-]/g, "_");
  const path = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(path, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("이 기기에서는 파일 공유를 지원하지 않습니다.");
  }
  await Sharing.shareAsync(path, {
    mimeType: "application/json",
    dialogTitle: "ArtMuse 데이터 백업",
    UTI: "public.json",
  });
}

let cachedDownloadDirUri = null;

function sanitizePdfFilename(filename) {
  const name = (filename || "portfolio.pdf").trim();
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

function sanitizeExportFilename(filename, fallback = "portfolio.bin") {
  const name = (filename || fallback).trim();
  return name.replace(/[^\w가-힣.-]/g, "_") || fallback;
}

function fileBaseName(filename) {
  const safe = sanitizeExportFilename(filename);
  const idx = safe.lastIndexOf(".");
  return idx > 0 ? safe.slice(0, idx) : safe;
}

/** Android: Downloads 폴더에 파일 저장 (SAF) */
async function saveFileToAndroidDownloads(filename, base64, mimeType) {
  const { StorageAccessFramework } = FileSystem;

  if (!cachedDownloadDirUri) {
    const initialUri = StorageAccessFramework.getUriForDirectoryInRoot("Download");
    const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri);
    if (!perm.granted) {
      throw new Error("다운로드 폴더 저장 권한이 필요합니다.");
    }
    cachedDownloadDirUri = perm.directoryUri;
  }

  const safeName = sanitizeExportFilename(filename);
  const fileUri = await StorageAccessFramework.createFileAsync(
    cachedDownloadDirUri,
    fileBaseName(safeName),
    mimeType || "application/octet-stream"
  );
  await StorageAccessFramework.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return {
    ok: true,
    method: "download",
    filename: safeName,
    path: "Download",
  };
}

/** iOS: 앱 문서 폴더에 저장 (파일 앱에서 확인 가능) */
async function saveFileToIosDocuments(filename, base64) {
  const safeName = sanitizeExportFilename(filename);
  const path = `${FileSystem.documentDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    ok: true,
    method: "download",
    filename: safeName,
    path: safeName,
  };
}

/** 임의 파일을 다운로드 폴더(Android) / 문서 폴더(iOS)에 저장 */
export async function exportPortfolioFile({ filename, base64, mimeType }) {
  if (!base64) {
    throw new Error("파일 데이터가 없습니다.");
  }

  if (Platform.OS === "android") {
    return saveFileToAndroidDownloads(filename, base64, mimeType);
  }

  if (Platform.OS === "ios") {
    return saveFileToIosDocuments(filename, base64);
  }

  const safeName = sanitizeExportFilename(filename);
  const path = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { ok: true, method: "download", filename: safeName, path };
}

/** PDF 포트폴리오를 다운로드 폴더(Android) / 문서 폴더(iOS)에 저장 */
export async function exportPortfolioPdf({ filename, base64 }) {
  if (!base64) {
    throw new Error("PDF 데이터가 없습니다.");
  }

  if (Platform.OS === "android") {
    return saveFileToAndroidDownloads(filename, base64, "application/pdf");
  }

  if (Platform.OS === "ios") {
    return saveFileToIosDocuments(filename, base64);
  }

  const safeName = sanitizePdfFilename(filename).replace(/[^\w가-힣.-]/g, "_");
  const path = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { ok: true, method: "download", filename: safeName, path };
}
