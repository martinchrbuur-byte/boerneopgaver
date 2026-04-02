-- Sprint migration — run this in the Supabase SQL editor
-- Adds: value column on chores, sprints table, sprint_id on records, app_settings table

-- 1. Add price value and repetition limit to chores
ALTER TABLE chores ADD COLUMN IF NOT EXISTS value numeric NOT NULL DEFAULT 0;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS max_per_sprint int NOT NULL DEFAULT 1;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS unlimited_daily_cap int NOT NULL DEFAULT 1;

-- 2. Sprints table
-- Note: id is TEXT (not uuid) because the app prefixes IDs: 'sprint_<uuid>'
CREATE TABLE IF NOT EXISTS sprints (
  id            text PRIMARY KEY,
  user_id       text NOT NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'active',  -- 'active' | 'paid'
  paid_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sprints_status_check CHECK (status IN ('active', 'paid'))
);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read/write sprints" ON sprints;
CREATE POLICY "Users can read own sprints" ON sprints
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own sprints" ON sprints
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own sprints" ON sprints
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own sprints" ON sprints
  FOR DELETE USING (auth.uid()::text = user_id);

-- 3. Add sprint_id to records
-- Note: TEXT to match app-generated sprint IDs like 'sprint_<uuid>'
ALTER TABLE records ADD COLUMN IF NOT EXISTS sprint_id text REFERENCES sprints(id);
ALTER TABLE records ADD COLUMN IF NOT EXISTS completed_by text;
ALTER TABLE records ADD COLUMN IF NOT EXISTS earned_value numeric;

-- 4. App settings (one row per household / user_id)
CREATE TABLE IF NOT EXISTS app_settings (
  user_id             text PRIMARY KEY,
  sprint_length_days  int NOT NULL DEFAULT 7,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read/write app_settings" ON app_settings;
CREATE POLICY "Users can read own settings" ON app_settings
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own settings" ON app_settings
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own settings" ON app_settings
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own settings" ON app_settings
  FOR DELETE USING (auth.uid()::text = user_id);
