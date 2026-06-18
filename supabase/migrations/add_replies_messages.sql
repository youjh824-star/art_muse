-- feedback_replies: 학부모가 선생님 피드백에 답변
CREATE TABLE IF NOT EXISTS feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid REFERENCES feedbacks(id) ON DELETE CASCADE,
  academy_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'parent')),
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feedback_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback_replies_access" ON feedback_replies
  USING (
    academy_id IN (SELECT id FROM academies WHERE owner_id = auth.uid())
    OR
    academy_id IN (SELECT academy_id FROM parent_student_links WHERE parent_user_id = auth.uid())
  );

-- messages: 원장-학부모 간 1:1 채팅 (학생 단위)
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'parent')),
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_access" ON messages
  USING (
    academy_id IN (SELECT id FROM academies WHERE owner_id = auth.uid())
    OR
    academy_id IN (SELECT academy_id FROM parent_student_links WHERE parent_user_id = auth.uid())
  );
