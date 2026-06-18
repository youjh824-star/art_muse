# openai-proxy Edge Function

APK 소스코드에 OpenAI API 키를 노출하지 않고 서버에서 안전하게 호출합니다.

## 배포 방법

```bash
# 1. Supabase CLI 로그인
supabase login

# 2. 프로젝트 연결 (처음 한 번만)
supabase link --project-ref <your-project-ref>

# 3. Edge Function 배포
supabase functions deploy openai-proxy --no-verify-jwt

# 4. OpenAI API 키 등록 (APK에 포함되지 않음)
supabase secrets set OPENAI_API_KEY=sk-...
```

## 동작 방식

```
[APK WebView / ArtlogNative bridge]
        ↓ GENERATE_AI_FEEDBACK
[mobile/src/native/openai.js]
        ↓ POST /functions/v1/openai-proxy
[Supabase Edge Function]  ← OPENAI_API_KEY는 여기에만 존재
        ↓
[api.openai.com]
```

## 환경변수

| 변수 | 위치 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | Supabase Secrets | OpenAI API 키 (APK 미포함) |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile/.env | Edge Function URL 자동 생성에 사용 |
| `EXPO_PUBLIC_OPENAI_MODEL` | mobile/.env (선택) | 기본값 gpt-4o-mini |
