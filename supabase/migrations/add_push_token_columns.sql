-- push_token 컬럼 추가 (알림 전송용)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token text;
ALTER TABLE parent_student_links ADD COLUMN IF NOT EXISTS push_token text;
