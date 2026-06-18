import { requestCameraPermissionsAsync } from "expo-camera";
import * as ImagePicker from "expo-image-picker";

const PICKER_OPTS = {
  mediaTypes: ["images"],
  allowsEditing: false,
  quality: 0.85,
  base64: true,
};

/** WebView img 태그용 data URI (file:// 는 http 페이지에서 차단됨) */
function assetToWebResult(asset) {
  const mime = asset.mimeType ?? "image/jpeg";
  const uri = asset.base64
    ? `data:${mime};base64,${asset.base64}`
    : asset.uri;
  return {
    uri,
    fileUri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? `artwork_${Date.now()}.jpg`,
  };
}

/** 카메라·갤러리 권한 요청 */
export async function requestMediaPermissions() {
  const camera = await requestCameraPermissionsAsync();
  const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return {
    camera: camera.status === "granted",
    library: library.status === "granted",
  };
}

/** 카메라로 작품 촬영 */
export async function takeArtworkPhoto() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("카메라 권한이 필요합니다.");
  }
  const result = await ImagePicker.launchCameraAsync(PICKER_OPTS);
  if (result.canceled || !result.assets?.[0]) return null;
  return assetToWebResult(result.assets[0]);
}

/** 갤러리에서 작품 사진 선택 */
export async function pickArtworkFromGallery() {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("사진 보관함 권한이 필요합니다.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    ...PICKER_OPTS,
    selectionLimit: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return assetToWebResult(result.assets[0]);
}
