-- ArtLog Ver 2: 플랜 시스템 + 입시 성적 + 비밀 상담 일지
-- Run: supabase db push  or  supabase sql < supabase/migrations/v2_plan.sql

-- 1. academies 테이블에 플랜 컬럼 추가
ALTER TABLE academies
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free','standard','premium')),
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;

-- 2. 입시 성적 테이블
CREATE TABLE IF NOT EXISTS exam_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id     uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_date      date NOT NULL,
  -- 실기 5항목 점수 {형태력,채색력,표현력,속도,아이디어}: 0-100
  practical_scores jsonb NOT NULL DEFAULT '{}',
  suneung_score  int,           -- 수능 총점
  naesin_grade   numeric(3,1),  -- 내신 등급 (1.0 ~ 9.0)
  target_schools text[] DEFAULT '{}',
  memo           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 3. 비밀 상담 일지 테이블
CREATE TABLE IF NOT EXISTS consultations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id   uuid NOT NULL REFERENCES academies(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  consult_date date NOT NULL,
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. RLS 활성화
ALTER TABLE exam_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- 5. 정책: 학원 소유자만 접근
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='exam_scores' AND policyname='academy owner exam'
  ) THEN
    CREATE POLICY "academy owner exam" ON exam_scores
      USING (academy_id IN (SELECT id FROM academies WHERE owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='consultations' AND policyname='academy owner consult'
  ) THEN
    CREATE POLICY "academy owner consult" ON consultations
      USING (academy_id IN (SELECT id FROM academies WHERE owner_id = auth.uid()));
  END IF;
END $$;

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_exam_scores_student   ON exam_scores(student_id, exam_date DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_student ON consultations(student_id, consult_date DESC);
