-- Sprint migration — run this in the Supabase SQL editor
-- Adds: value column on chores, sprints table, sprint_id on records, app_settings table

-- 1. Add price value and repetition limit to chores
ALTER TABLE chores ADD COLUMN IF NOT EXISTS value numeric NOT NULL DEFAULT 0;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS max_per_sprint int NOT NULL DEFAULT 1;

-- 2. Sprints table
CREATE TABLE IF NOT EXISTS sprints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'active',  -- 'active' | 'paid'
  paid_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sprints_status_check CHECK (status IN ('active', 'paid'))
);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read/write sprints" ON sprints USING (true) WITH CHECK (true);

-- 3. Add sprint_id to records
ALTER TABLE records ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES sprints(id);

-- 4. App settings (one row per household / user_id)
CREATE TABLE IF NOT EXISTS app_settings (
  user_id             text PRIMARY KEY,
  sprint_length_days  int NOT NULL DEFAULT 7,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read/write app_settings" ON app_settings USING (true) WITH CHECK (true);
