-- 상담 일지 구조화: 상담자/유형/대상/태그/학생반응/후속조치/다음상담일/성적스냅샷
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS counselor         text,
  ADD COLUMN IF NOT EXISTS consult_type      text NOT NULL DEFAULT '정기',
  ADD COLUMN IF NOT EXISTS attendees         text NOT NULL DEFAULT '학생 단독',
  ADD COLUMN IF NOT EXISTS tags              text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reaction          text,
  ADD COLUMN IF NOT EXISTS follow_up         text,
  ADD COLUMN IF NOT EXISTS next_consult_date date,
  ADD COLUMN IF NOT EXISTS exam_snapshot     jsonb;

CREATE INDEX IF NOT EXISTS idx_consultations_tags ON consultations USING gin(tags);
