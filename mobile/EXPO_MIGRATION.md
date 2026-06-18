# React Native + Expo 전환 가이드 (ArtLog)

기존 `artlog-demo.jsx` (React PWA / Vite)를 **React Native + Expo**로 포팅하기 위한 단계별 가이드입니다.

## 프로젝트 구조

```
app/
├── artlog-demo.jsx      # 웹 UI (현재 PWA)
├── src/main.jsx         # Vite 진입점
├── mobile/              # Expo 네이티브 앱
│   ├── App.js
│   ├── app.config.js    # 권한·스토어 설정
│   ├── eas.json         # EAS Build / Submit
│   └── src/
│       ├── native/      # camera, picker, notifications, bridge
│       └── components/  # WebView, NativeUploadModal
└── EXPO_MIGRATION.md    # 이 문서
```

## 전환 전략 (3단계)

### 1단계 — WebView + Native Bridge (현재 구현)

| 항목 | 설명 |
|------|------|
| UI | 기존 React 웹앱을 `react-native-webview`로 로드 |
| 네이티브 | 카메라·갤러리·푸시는 RN에서 처리 후 `window.ArtlogNative`로 연결 |
| 장점 | 빠른 출시, 기존 UI 100% 재사용 |
| 단점 | WebView 성능·오프라인 한계 |

**실행 방법**

```bash
# 터미널 1 — 웹 dev server
npm run dev

# 터미널 2 — Expo (실기기/에뮬레이터)
cd mobile
npm install
npm start
```

실기기에서 `localhost` 접근 시 PC IP 사용:

```bash
# Windows — IP 확인 후
set EXPO_PUBLIC_WEB_APP_URL=http://192.168.0.10:5173
npm start
```

`mobile/app.config.js`의 `extra.webAppUrl` 또는 `.env`로 설정합니다.

### 2단계 — 화면별 RN 컴포넌트 전환

웹 → RN 매핑:

| Web (PWA) | React Native |
|-----------|--------------|
| `div` | `View` |
| `span`, `p` | `Text` |
| `button` | `Pressable` / `TouchableOpacity` |
| `input`, `textarea` | `TextInput` |
| `img` | `Image` |
| `style={{}}` | `StyleSheet.create()` |
| `BottomSheet` (fixed) | `@gorhom/bottom-sheet` 또는 RN `Modal` |
| `window.confirm` | `Alert.alert` |
| `overflowX: auto` | `ScrollView` horizontal |

공통 로직(학생 데이터, 출결 키, 공휴일)은 `shared/` 폴더로 분리:

```
shared/
  constants.js    # CLASS_TIMES, DEPTS, KOREAN_HOLIDAYS
  students.js     # 초기 데이터
  attendance.js   # attendKey, getActiveClassTime
```

### 3단계 — 완전 네이티브 UI

- `mobile/src/screens/` 에 AdminHome, AdminStudents 등 RN 화면 구현
- `@react-navigation/native` 탭 네비게이션
- Supabase / API 연동
- WebView 제거

---

## 네이티브 기능

### expo-camera / expo-image-picker

`mobile/src/native/media.js`

- `takeArtworkPhoto()` — 카메라 촬영
- `pickArtworkFromGallery()` — 갤러리 선택

웹 `UploadModal`에서:

```javascript
await window.ArtlogNative.openCamera();
await window.ArtlogNative.openGallery();
```

### expo-notifications

`mobile/src/native/notifications.js`

- `registerForPushNotifications()` — Expo Push Token 발급
- `notifyAttendance()` / `notifyFeedback()` — 로컬 알림 (데모)

출결·피드백 저장 시 웹에서:

```javascript
window.ArtlogNative.notifyAttendance({ studentName, status });
window.ArtlogNative.notifyFeedback({ studentName });
```

**프로덕션 푸시**: Expo Push API + 백엔드에서 `https://exp.host/--/api/v2/push/send` 호출

---

## Expo 설정 (`app.config.js`)

| 설정 | 값 |
|------|-----|
| iOS Bundle ID | `kr.artmuse.artlog` |
| Android Package | `kr.artmuse.artlog` |
| Scheme | `artlog://` |
| 권한 | 카메라, 사진, 푸시 (한국어 설명 포함) |

플러그인: `expo-camera`, `expo-image-picker`, `expo-notifications`

---

## 앱스토어 · 플레이스토어 배포

### 사전 준비

1. [Expo 계정](https://expo.dev) + `eas login`
2. `eas init` → `app.config.js`의 `extra.eas.projectId` 업데이트
3. **iOS**: Apple Developer Program ($99/년)
4. **Android**: Google Play Console ($25 1회)
5. 앱 아이콘 교체: `mobile/assets/icon.png` (1024×1024)

### EAS Build

```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure

# 내부 테스트 (APK)
eas build --profile preview --platform android

# 스토어 제출용
eas build --profile production --platform all
```

`eas.json` 프로필:

- **development** — Dev Client, 시뮬레이터
- **preview** — 내부 QA (APK)
- **production** — AAB (Android) / IPA (iOS), autoIncrement

### EAS Submit

`eas.json` → `submit.production` 에 계정 정보 입력:

**iOS**

```json
"ios": {
  "appleId": "your@email.com",
  "ascAppId": "App Store Connect App ID",
  "appleTeamId": "TEAM_ID"
}
```

**Android**

- Google Play Console → API 액세스 → 서비스 계정 JSON
- `play-store-service-account.json` (gitignore 필수)

```bash
eas submit --platform ios --latest
eas submit --platform android --latest
```

### Firebase (Android FCM, 선택)

1. Firebase 프로젝트 생성
2. `google-services.json` → `mobile/google-services.json`
3. `app.config.js`의 `android.googleServicesFile` 경로 확인

---

## 체크리스트

- [ ] `mobile/assets/` 아이콘·스플래시 실제 디자인으로 교체
- [ ] `EAS_PROJECT_ID` 환경 변수 설정
- [ ] 프로덕션 `EXPO_PUBLIC_WEB_APP_URL` (배포된 PWA URL)
- [ ] `eas.json` Apple / Google 계정 정보
- [ ] 개인정보처리방침 URL (스토어 필수)
- [ ] WebView 제거 후 RN 화면 전환 (2~3단계)

---

## 자주 묻는 문제

**Q. 에뮬레이터에서 WebView가 빈 화면**  
A. Android 에뮬레이터는 `http://10.0.2.2:5173` 사용. iOS 시뮬레이터는 `localhost:5173` 가능.

**Q. 카메라가 웹에서 안 됨**  
A. 정상입니다. Expo 앱(WebView)에서만 `ArtlogNative` 브릿지가 동작합니다.

**Q. 푸시가 시뮬레이터에서 안 됨**  
A. iOS/Android 시뮬레이터는 원격 푸시 미지원. 실기기 + `expo-notifications` 로컬 알림으로 테스트.
