# boerneopgaver (Chore Champions)

Purpose: Chore Champions is a lightweight, kid-friendly chore tracking MVP. It allows:
- Children to view chores and mark them complete
- Children to undo a completion
- Parents to add chores and review recent completion activity
- Users to switch between separate Parent and Kid views

## Data Persistence with Supabase

This app integrates with Supabase for cloud data persistence while maintaining offline support through localStorage.

### Quick Start

1. **Get your Supabase API key:**
   - Visit: https://app.supabase.com/project/mfydufcizonxjmgyrwkj/settings/api
   - Copy the "anon public" key

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Add your API key to `.env`:**
   ```
   SUPABASE_ANON_KEY=your_copied_key_here
   ```

4. **Set up the database:**
   - Follow the detailed instructions in [docs/supabase-setup.md](docs/supabase-setup.md)
   - Run the SQL migrations in your Supabase SQL Editor

5. **Load environment variables in development:**
   ```bash
   npm install dotenv
   ```
   Then add at the top of your entry point:
   ```javascript
   import dotenv from 'dotenv';
   dotenv.config();
   ```

### Architecture

- **Hybrid Storage**: Data automatically syncs to both localStorage and Supabase
- **Offline First**: App works offline using localStorage, syncs when online
- **Fallback**: If Supabase is unavailable, app uses localStorage only
- **No Data Loss**: All saves are persisted locally before attempting cloud sync

### Environment Variables

- `SUPABASE_ANON_KEY` - Your Supabase anonymous API key (never commit this!)

See [docs/supabase-setup.md](docs/supabase-setup.md) for complete setup instructions.
