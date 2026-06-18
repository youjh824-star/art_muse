# ArtLog Supabase 프로덕션 설정

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성
2. **Settings → API** 에서 URL과 `anon` key 복사

## 2. 환경 변수

`app/.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_OPENAI_API_KEY=sk-...
```

`mobile/.env` (EAS 빌드·동기화용):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_OPENAI_API_KEY=sk-...
EAS_PROJECT_ID=...
```

EAS 클라우드 빌드:

```bash
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://..." --environment preview --visibility plaintext --force
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --environment preview --visibility sensitive --force
```

## 3. DB 스키마 + RLS

**주의:** SQL Editor에 `supabase/schema.sql` 같은 **파일 경로**를 입력하면 안 됩니다.  
PostgreSQL은 경로를 SQL로 인식하지 못해 `syntax error at or near "supabase"` 오류가 납니다.

### 방법 A — 파일 내용 붙여넣기 (권장)

1. Cursor/VS Code에서 **`c:\Users\User\Desktop\app\supabase\schema.sql`** 파일을 엽니다.
2. **전체 선택** (Ctrl+A) → **복사** (Ctrl+C)
3. Supabase Dashboard → **SQL Editor** → **New query**
4. 복사한 **SQL 전체**를 붙여넣기 (맨 위는 `-- ArtLog Supabase schema` 주석으로 시작)
5. **Run** (또는 Ctrl+Enter)
6. 성공 메시지 확인 후 **Table Editor**에서 `academies`, `students` 등 테이블 생성 여부 확인

### 방법 B — Supabase CLI (선택)

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

포함 내용:
- `academies`, `profiles`, `students`, `artworks`, `feedbacks`, `notices`, `schedules`, `invites`, `parent_student_links`, `attendance`
- RLS 정책 (원장 CRUD / 학부모 읽기·작품 업로드)
- Storage bucket `artworks`
- RPC: `bootstrap_admin_academy`, `peek_invite`, `link_parent_with_invite`
- Realtime publication

## 4. Auth 설정

**Authentication → Providers → Email** 활성화.

### 개발 중 필수 (회원가입 `email rate limit exceeded` 방지)

Supabase 무료 플랜은 **인증 메일 발송 횟수**에 제한이 있습니다. 테스트 중 같은 이메일로 여러 번 가입하면 `email rate limit exceeded` 가 납니다.

1. **Authentication → Sign In / Providers → Email**
2. **Confirm email (이메일 확인)** → **OFF** (개발용)
3. 저장 후 앱에서 **다른 이메일**로 가입하거나 **1시간 정도 대기**

이미 가입을 시도했다면 **로그인** 탭으로 바꿔 같은 비밀번호로 로그인해 보세요.

(프로덕션 런치 전에는 Confirm email을 다시 켜세요.)

### Rate Limits (선택)

**Authentication → Rate Limits** 에서 시간당 이메일 한도 확인 (Pro 플랜에서 조정 가능).

## 5. RLS 테스트

SQL Editor에서 (각 역할 JWT로 테스트하거나 앱에서):

```sql
-- 원장: 본인 academy_id 학생만
select * from students;

-- 학부모: 연결된 학생만
select * from students;
```

`supabase/tests/rls_checklist.md` 체크리스트 참고.

## 6. 앱 URL (학부모 초대)

`src/lib/urls.js`에서 스토어 등록 후 실제 URL로 교체:

- iOS: App Store Connect 앱 ID
- Android: `kr.artmuse.artlog.parent` / `kr.artmuse.artlog.admin`

## 7. 오프라인 네이티브 앱 (터미널 불필요)

내장 웹 + Supabase 클라우드 — 로컬 서버 없이 동작.

```bash
# Android APK
npm run mobile:build:preview:admin
npm run mobile:build:preview:parent

# iOS (Apple Developer 계정 필요)
npm run mobile:build:preview:admin:ios
npm run mobile:build:preview:parent:ios
```

## 8. 웹 배포 (선택)

```bash
npm run build:admin    # 원장 PWA → dist/
npm run build:parent   # 학부모 PWA → dist/
```

호스팅 시 각각 `admin.artmuse.kr`, `parent.artmuse.kr` 등 분리 배포.

## 9. 첫 사용

1. **ArtLog 원장** 앱 설치 → 회원가입 → 학원·학생 등록
2. 학부모 계정 관리 → 초대 코드 생성 → 문구 복사 (학부모 앱 링크 포함)
3. **ArtLog 학부모** 앱 설치 → 코드 + 이메일/비밀번호로 가입
