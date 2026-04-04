# Supabase Database Setup

This file contains the SQL migrations to set up the database for the chore tracker app in Supabase.

## Steps to Set Up:

1. Go to your Supabase dashboard: https://app.supabase.com/project/mfydufcizonxjmgyrwkj
2. Navigate to SQL Editor
3. Create a new query and run the SQL below

## SQL Migrations:

```sql
-- Create chores table
CREATE TABLE IF NOT EXISTS chores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  assigned_to JSONB NOT NULL DEFAULT '[]',
  user_id TEXT NOT NULL,
  created_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create records table
CREATE TABLE IF NOT EXISTS records (
  id TEXT PRIMARY KEY,
  chore_id TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  undone_at TEXT,
  user_id TEXT NOT NULL,
  period_id TEXT,
  completed_by TEXT,
  earned_value NUMERIC,
  created_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chore_id) REFERENCES chores(id)
);

-- Create ui_state table
CREATE TABLE IF NOT EXISTS ui_state (
  id TEXT PRIMARY KEY,
  active_role TEXT DEFAULT 'parent',
  user_id TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_chores_user_id ON chores(user_id);
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_chore_id ON records(chore_id);
CREATE INDEX IF NOT EXISTS idx_ui_state_user_id ON ui_state(user_id);

-- Enable Row Level Security (optional, for multi-user support)
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ui_state ENABLE ROW LEVEL SECURITY;

-- Auth-based policies (one family account per user_id)
-- user_id is stored as text, so compare with auth.uid()::text
CREATE POLICY "Users can read own chores" ON chores
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own chores" ON chores
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own chores" ON chores
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own chores" ON chores
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can read own records" ON records
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own records" ON records
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own records" ON records
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own records" ON records
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can read own ui_state" ON ui_state
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own ui_state" ON ui_state
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own ui_state" ON ui_state
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own ui_state" ON ui_state
  FOR DELETE USING (auth.uid()::text = user_id);
```

## Important if you already ran the old public policy setup:

If you already enabled RLS with public policies, replace them with auth-based policies once:

```sql
DROP POLICY IF EXISTS "Public can read chores" ON chores;
DROP POLICY IF EXISTS "Public can insert chores" ON chores;
DROP POLICY IF EXISTS "Public can update chores" ON chores;
DROP POLICY IF EXISTS "Public can delete chores" ON chores;
DROP POLICY IF EXISTS "Public can read records" ON records;
DROP POLICY IF EXISTS "Public can insert records" ON records;
DROP POLICY IF EXISTS "Public can update records" ON records;
DROP POLICY IF EXISTS "Public can delete records" ON records;
DROP POLICY IF EXISTS "Public can read ui_state" ON ui_state;
DROP POLICY IF EXISTS "Public can insert ui_state" ON ui_state;
DROP POLICY IF EXISTS "Public can update ui_state" ON ui_state;
DROP POLICY IF EXISTS "Public can delete ui_state" ON ui_state;

CREATE POLICY "Users can read own chores" ON chores
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own chores" ON chores
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own chores" ON chores
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own chores" ON chores
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can read own records" ON records
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own records" ON records
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own records" ON records
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own records" ON records
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can read own ui_state" ON ui_state
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own ui_state" ON ui_state
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own ui_state" ON ui_state
  FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own ui_state" ON ui_state
  FOR DELETE USING (auth.uid()::text = user_id);
```

## One-time claim of existing anonymous data

If you already have rows with `user_id = 'anonymous'`, run this once while logged in as the family account to claim that data:

```sql
UPDATE chores SET user_id = auth.uid()::text WHERE user_id = 'anonymous';
UPDATE records SET user_id = auth.uid()::text WHERE user_id = 'anonymous';
UPDATE ui_state SET user_id = auth.uid()::text, id = auth.uid()::text WHERE user_id = 'anonymous';
UPDATE periods SET user_id = auth.uid()::text WHERE user_id = 'anonymous';
UPDATE app_settings SET user_id = auth.uid()::text WHERE user_id = 'anonymous';
```

## Get Your API Key:

1. Go to Project Settings (gear icon) → API
2. Copy the publishable key under Project API keys
3. Set it for browser runtime using one of these options:
   - `window.SUPABASE_PUBLISHABLE_KEY = 'your_copied_key_here'` in `index.html` before the app script
   - `localStorage.setItem('SUPABASE_PUBLISHABLE_KEY', 'your_copied_key_here')` in DevTools Console

## Using with Environment Variables:

### For Node.js scripts/testing only:
Use a `.env` file if you run Node scripts (for example `npm run test:supabase`).

```bash
SUPABASE_PUBLISHABLE_KEY=your_key_here
```

### For Browser/Static Hosting:
Use one of these options:

**Option 1: Build-time injection (GitHub Pages)**
- Set `SUPABASE_PUBLISHABLE_KEY` in GitHub repository secrets
- The deploy workflow injects it into the built artifact

**Option 2: Runtime key in browser**
- Set `window.SUPABASE_PUBLISHABLE_KEY` in `index.html`
- Or persist it with `localStorage.setItem('SUPABASE_PUBLISHABLE_KEY', '...')`

## Development Setup:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your publishable key in browser runtime:
   - Add `window.SUPABASE_PUBLISHABLE_KEY` in `index.html`, or
   - Run `localStorage.setItem('SUPABASE_PUBLISHABLE_KEY', '...')` in DevTools

3. Reload the app and sign in

4. Data will now sync to both localStorage and Supabase automatically!

## Architecture:

- **Hybrid Storage**: Data syncs to both localStorage (for offline support) and Supabase (for cloud persistence)
- **Fallback**: If Supabase is not configured or unavailable, the app uses localStorage only
- **userId Tracking**: All data is tagged with `user_id` for multi-user support in the future
- **Async Sync**: Supabase saves happen asynchronously to keep UI responsive

## Troubleshooting:

- Check the browser console for any Supabase errors
- Make sure your publishable key is valid
- Verify the database tables exist in your Supabase project
- Check Row Level Security (RLS) policies if data doesn't sync

## Key types

- Use a **publishable key** in this app because it runs in the browser.
- Do **not** use a **secret key** in a static site or client-side JavaScript.
- Secret keys are server-only.
