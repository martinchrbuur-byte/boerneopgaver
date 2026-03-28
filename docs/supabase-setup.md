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

-- Create policies (optional - for authenticated users only)
CREATE POLICY "Users can see their own chores" ON chores
  FOR SELECT USING (user_id = auth.uid()::TEXT);

CREATE POLICY "Users can see their own records" ON records
  FOR SELECT USING (user_id = auth.uid()::TEXT);

CREATE POLICY "Users can see their own ui_state" ON ui_state
  FOR SELECT USING (user_id = auth.uid()::TEXT);
```

## Get Your API Key:

1. Go to Project Settings (gear icon) → API
2. Copy the "anon public" key under Project API keys
3. Set it in your `.env` file:
   ```
   SUPABASE_ANON_KEY=your_copied_key_here
   ```

## Using with Environment Variables:

### For Node.js/Testing:
```bash
# Create .env file in project root
SUPABASE_ANON_KEY=your_key_here

# Install dotenv
npm install dotenv
```

Then in your app initialization, load the env file:
```javascript
import dotenv from 'dotenv';
dotenv.config();
```

### For Browser/Static Hosting:
You have two options:

**Option 1: Build-time environment variables (GitHub Pages)**
- Set the secret in your GitHub repository settings
- Use a build process to inject it during deployment

**Option 2: Direct API Key in code**
- For development/learning: Replace the empty string in [supabaseConfig.js](src/config/supabaseConfig.js)
- WARNING: Never commit API keys to version control in production!

## Development Setup:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Add your Supabase anon key to `.env`

4. Load environment variables in your app or import dotenv

5. Data will now sync to both localStorage and Supabase automatically!

## Architecture:

- **Hybrid Storage**: Data syncs to both localStorage (for offline support) and Supabase (for cloud persistence)
- **Fallback**: If Supabase is not configured or unavailable, the app uses localStorage only
- **userId Tracking**: All data is tagged with `user_id` for multi-user support in the future
- **Async Sync**: Supabase saves happen asynchronously to keep UI responsive

## Troubleshooting:

- Check the browser console for any Supabase errors
- Make sure your API key is valid and hasn't expired
- Verify the database tables exist in your Supabase project
- Check Row Level Security (RLS) policies if data doesn't sync
