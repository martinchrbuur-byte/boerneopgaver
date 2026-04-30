-- Spotify integration migration — run this in the Supabase SQL editor
-- Adds secure per-household Spotify connection storage for Edge Functions.

CREATE TABLE IF NOT EXISTS spotify_connections (
  user_id           text PRIMARY KEY,
  spotify_user_id   text,
  access_token      text NOT NULL,
  refresh_token     text NOT NULL,
  scope             text,
  token_type        text,
  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spotify_connections_expires_at
  ON spotify_connections (expires_at);

ALTER TABLE spotify_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read/write spotify_connections" ON spotify_connections;
CREATE POLICY "Users can read own spotify connection" ON spotify_connections
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own spotify connection" ON spotify_connections
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own spotify connection" ON spotify_connections
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own spotify connection" ON spotify_connections
  FOR DELETE USING (auth.uid()::text = user_id);
