import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { takeArtworkPhoto, pickArtworkFromGallery } from "../native/media";

const C = {
  cream: "#FAF7F2",
  beige: "#F0EBE3",
  terra: "#C17F5B",
  charcoal: "#3D3530",
  warm: "#8C7B72",
  light: "#D4CBC4",
  white: "#FFFFFF",
};

const DEMO_STUDENTS = [
  { id: "1", name: "김서아", school: "한별초", grade: "초4", art: "🌸" },
  { id: "3", name: "이나연", school: "푸른중", grade: "중1", art: "🌊" },
  { id: "5", name: "한소율", school: "무지개초", grade: "초3", art: "🌻" },
];

/** 순수 RN 업로드 UI — WebView 없이 네이티브만 사용할 때 */
export default function NativeUploadModal({ visible, onClose, students = DEMO_STUDENTS }) {
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState(null);
  const [selStudent, setSelStudent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setPhoto(null);
      setSelStudent(null);
      setLoading(false);
    }
  }, [visible]);

  const handleCamera = async () => {
    setLoading(true);
    try {
      const result = await takeArtworkPhoto();
      if (result) {
        setPhoto(result);
        setStep(2);
      }
    } catch (e) {
      Alert.alert("카메라 오류", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGallery = async () => {
    setLoading(true);
    try {
      const result = await pickArtworkFromGallery();
      if (result) {
        setPhoto(result);
        setStep(2);
      }
    } catch (e) {
      Alert.alert("갤러리 오류", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {step === 1 && "① 사진 선택"}
            {step === 2 && "② 학생 선택"}
            {step === 3 && "업로드 완료"}
          </Text>

          {step === 1 && (
            <>
              <Text style={styles.sub}>expo-camera · expo-image-picker</Text>
              {photo && (
                <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
              )}
              {loading ? (
                <ActivityIndicator color={C.terra} style={{ marginVertical: 24 }} />
              ) : (
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btnSecondary} onPress={handleCamera}>
                    <Text style={styles.btnSecondaryText}>📷 카메라</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnSecondary} onPress={handleGallery}>
                    <Text style={styles.btnSecondaryText}>🖼 갤러리</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {photo && (
                <Image source={{ uri: photo.uri }} style={styles.previewSmall} resizeMode="cover" />
              )}
              <ScrollView style={{ maxHeight: 220, marginBottom: 16 }}>
                {students.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.studentRow, selStudent?.id === s.id && styles.studentSel]}
                    onPress={() => setSelStudent(s)}
                  >
                    <Text style={{ fontSize: 26 }}>{s.art}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.studentName}>{s.name}</Text>
                      <Text style={styles.studentSub}>{s.school} {s.grade}</Text>
                    </View>
                    {selStudent?.id === s.id && <Text style={{ color: C.terra, fontWeight: "700" }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.row}>
                <TouchableOpacity style={styles.btnSecondary} onPress={() => setStep(1)}>
                  <Text style={styles.btnSecondaryText}>← 이전</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnPrimary, !selStudent && styles.btnDisabled]}
                  disabled={!selStudent}
                  onPress={() => setStep(3)}
                >
                  <Text style={styles.btnPrimaryText}>저장하기</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === 3 && (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
              <Text style={styles.doneTitle}>업로드 완료!</Text>
              <Text style={styles.sub}>{selStudent?.name}의 작품이 저장되었습니다</Text>
              <TouchableOpacity style={[styles.btnPrimary, { width: "100%", marginTop: 20 }]} onPress={onClose}>
                <Text style={styles.btnPrimaryText}>확인</Text>
              </TouchableOpacity>
            </View>
          )}

          {step < 3 && (
            <TouchableOpacity onPress={onClose} style={{ marginTop: 12, alignItems: "center" }}>
              <Text style={{ color: C.warm, fontSize: 13 }}>닫기</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "88%",
  },
  handle: { width: 40, height: 4, backgroundColor: C.light, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 16, fontWeight: "700", color: C.charcoal, marginBottom: 8 },
  sub: { fontSize: 13, color: C.warm, marginBottom: 16, lineHeight: 20 },
  preview: { width: "100%", height: 180, borderRadius: 12, marginBottom: 16, backgroundColor: C.beige },
  previewSmall: { width: "100%", height: 100, borderRadius: 12, marginBottom: 12, backgroundColor: C.beige },
  row: { flexDirection: "row", gap: 10 },
  btnPrimary: { flex: 2, backgroundColor: C.terra, padding: 14, borderRadius: 12, alignItems: "center" },
  btnPrimaryText: { color: C.white, fontWeight: "700", fontSize: 14 },
  btnSecondary: { flex: 1, backgroundColor: C.beige, padding: 14, borderRadius: 12, alignItems: "center" },
  btnSecondaryText: { color: C.charcoal, fontWeight: "600", fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.beige,
    marginBottom: 8,
  },
  studentSel: { backgroundColor: "#FFF5EE", borderWidth: 2, borderColor: C.terra },
  studentName: { fontSize: 14, fontWeight: "700", color: C.charcoal },
  studentSub: { fontSize: 11, color: C.warm, marginTop: 2 },
  doneTitle: { fontSize: 18, fontWeight: "800", color: C.charcoal, marginBottom: 8 },
});
