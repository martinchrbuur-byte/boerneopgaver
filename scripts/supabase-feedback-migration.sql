-- Feedback migration — run this in the Supabase SQL editor
-- Adds a feedback table so parent-written notes can sync and later be imported into VS Code.

CREATE TABLE IF NOT EXISTS feedback (
  id          text PRIMARY KEY,
  user_id     text NOT NULL,
  title       text NOT NULL DEFAULT '',
  message     text NOT NULL,
  category    text NOT NULL DEFAULT 'general',
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  text NOT NULL DEFAULT 'parent',
  status      text NOT NULL DEFAULT 'open',
  CONSTRAINT feedback_category_check CHECK (category IN ('general', 'bug', 'idea', 'quality', 'question')),
  CONSTRAINT feedback_status_check CHECK (status IN ('open')),
  CONSTRAINT feedback_created_by_check CHECK (created_by IN ('parent'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read/write feedback" ON feedback;
CREATE POLICY "Users can read own feedback" ON feedback
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own feedback" ON feedback
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own feedback" ON feedback
  FOR DELETE USING (auth.uid()::text = user_id);