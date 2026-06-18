# ArtLog 스토어 배포 가이드 (EAS Build)

Expo Go 개발이 끝났다면, **독립 APK/AAB** 를 만들어 Play Store / App Store에 올릴 수 있습니다.

---

## 빌드 프로필 요약

| 프로필 | 용도 | 웹앱 로드 방식 |
|--------|------|----------------|
| **preview** | 내부 테스트 APK (Android) | 앱에 **웹 번들 내장** (서버 불필요) |
| **production** | 스토어 제출용 | **HTTPS URL** (배포된 웹앱) |

---

## 1단계 — Expo / EAS 계정

```cmd
cd C:\Users\User\Desktop\app\mobile
npm.cmd install
npx.cmd eas login
npx.cmd eas init
```

`eas init` 후 `app.config.js`의 `projectId`가 자동 연결됩니다.  
또는 [expo.dev](https://expo.dev)에서 프로젝트 생성 후 `.env`에 추가:

```
EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## 2단계 — Preview APK (Android, 추천 첫 빌드)

PC 서버 없이 **단독 APK** 로 테스트합니다.

```cmd
cd C:\Users\User\Desktop\app
npm.cmd run mobile:build:preview
```

내부 동작:
1. `vite build --mode mobile` → `mobile/embedded-web/` 생성
2. EAS 클라우드에서 Android APK 빌드

빌드 완료 후 expo.dev 대시보드에서 **APK 다운로드** → 폰에 설치.

> Expo Go 없이 독립 앱으로 실행됩니다.

---

## 3단계 — Production (Play Store / App Store)

### A. 웹앱 HTTPS 배포 (필수)

Production 빌드는 **배포된 웹 URL** 을 WebView로 엽니다.

1. 웹 빌드:
   ```cmd
   cd C:\Users\User\Desktop\app
   npm.cmd run build
   ```
2. `dist/` 폴더를 Vercel / Netlify / Cloudflare Pages 등에 배포
3. `mobile/eas.json` → `production.env.EXPO_PUBLIC_WEB_APP_URL` 을 실제 URL로 수정:
   ```json
   "EXPO_PUBLIC_WEB_APP_URL": "https://artlog.yourdomain.com"
   ```

### B. Android (Play Store)

1. [Google Play Console](https://play.google.com/console) 개발자 등록 ($25)
2. Production 빌드:
   ```cmd
   cd C:\Users\User\Desktop\app\mobile
   npm.cmd run build:production:android
   ```
   → **AAB** (app-bundle) 파일 생성

3. (선택) 자동 제출 — Play Console 서비스 계정 JSON:
   - `mobile/play-store-service-account.json` 저장 (git 제외됨)
   - `eas.json` → `submit.production.android` 설정 확인
   ```cmd
   npm.cmd run submit:android
   ```

### C. iOS (App Store)

1. [Apple Developer Program](https://developer.apple.com) 가입 ($99/년)
2. `eas.json` → `submit.production.ios` 에 Apple ID / Team ID / ASC App ID 입력
3. 빌드:
   ```cmd
   npm.cmd run build:production
   ```
4. 제출:
   ```cmd
   npm.cmd run submit:ios
   ```

---

## 4단계 — 원격 푸시 (선택)

현재는 **로컬 알림**(같은 기기)으로 동작합니다.  
학부모 기기로 **원격 푸시**를 보내려면:

1. EAS `projectId` 설정 (1단계)
2. Android: Firebase → `google-services.json` → `mobile/google-services.json`
3. `app.config.js`의 `GOOGLE_SERVICES_JSON` 환경 변수 또는 파일 경로 설정
4. 서버에서 Expo Push API로 토큰에 전송

---

## 자주 쓰는 명령

```cmd
# 개발 (Expo Go)
npm.cmd run dev                    # Vite
cd mobile && npm.cmd run dev:metro # Metro

# 웹 번들만 생성 (embedded-web)
npm.cmd run mobile:bundle

# Preview APK
npm.cmd run mobile:build:preview

# Production AAB / IPA
npm.cmd run mobile:build:production
```

---

## 체크리스트

- [ ] `eas login` + `eas init` 완료
- [ ] Preview APK 설치 후 카메라·알림·WebView 동작 확인
- [ ] Production URL HTTPS 배포
- [ ] `eas.json` production URL 수정
- [ ] Play / App Store 개발자 계정
- [ ] 스토어 스크린샷·개인정보 처리방침 URL 준비

---

## 앱 정보

| 항목 | 값 |
|------|-----|
| 앱 이름 | ArtLog |
| Android 패키지 | `kr.artmuse.artlog` |
| iOS Bundle ID | `kr.artmuse.artlog` |
| Expo SDK | 54 |
