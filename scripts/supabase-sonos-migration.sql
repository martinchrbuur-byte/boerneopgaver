-- Sonos integration migration — run this in the Supabase SQL editor
-- Adds secure per-household Sonos connection storage for Edge Functions.

CREATE TABLE IF NOT EXISTS sonos_connections (
  user_id           text PRIMARY KEY,
  access_token      text NOT NULL,
  refresh_token     text NOT NULL,
  scope             text,
  token_type        text,
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sonos_connections_expires_at
  ON sonos_connections (expires_at);

ALTER TABLE sonos_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own sonos connection" ON sonos_connections;
DROP POLICY IF EXISTS "Users can insert own sonos connection" ON sonos_connections;
DROP POLICY IF EXISTS "Users can update own sonos connection" ON sonos_connections;
DROP POLICY IF EXISTS "Users can delete own sonos connection" ON sonos_connections;

CREATE POLICY "Users can read own sonos connection" ON sonos_connections
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own sonos connection" ON sonos_connections
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own sonos connection" ON sonos_connections
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own sonos connection" ON sonos_connections
  FOR DELETE USING (auth.uid()::text = user_id);
