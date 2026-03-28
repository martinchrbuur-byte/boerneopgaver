# Supabase Integration - Quick Start Checklist

Follow these steps to get data persistence working with Supabase:

## 1. Get Your API Key ✓
- [ ] Open: https://app.supabase.com/project/mfydufcizonxjmgyrwkj/settings/api
- [ ] Copy the publishable key under "Project API keys"

## 2. Set Up Environment Variable
Choose one option:

### Option A: Development (using .env file)
- [ ] Copy `.env.example` to `.env`: `cp .env.example .env`
- [ ] Open `.env` and paste your API key
- [ ] Install dotenv: `npm install dotenv`
- [ ] The .env file is in .gitignore - won't be committed

### Option B: Direct Configuration (quick testing)
- [ ] Open `src/config/supabaseConfig.js`
- [ ] Replace the empty string with your API key
- [ ] Remember to remove it before committing!

## 3. Create Database Tables
- [ ] Open your Supabase dashboard
- [ ] Go to SQL Editor
- [ ] Copy all SQL from [docs/supabase-setup.md](supabase-setup.md)
- [ ] Run the SQL in your project
- [ ] Verify tables are created (chores, records, ui_state)

## 4. Load Environment Variables (if using .env)
Add this to the top of your app initialization:
```javascript
import dotenv from 'dotenv';
dotenv.config();
```

## 5. Test the Integration
- [ ] Install dependencies: `npm install`
- [ ] Start your dev server or open index.html
- [ ] Open browser DevTools (F12)
- [ ] Check Console tab for "Connected to Supabase" message
- [ ] Create/complete a chore
- [ ] Verify data appears in your Supabase database
  - Go to Supabase Dashboard → your project
  - Check the Tables tab for data

## 6. Verify Data Sync
- [ ] Data appears in Supabase `chores` table
- [ ] Data appears in Supabase `records` table
- [ ] Data appears in Supabase `ui_state` table
- [ ] Refresh page - data persists from Supabase

## Troubleshooting

### "Supabase is not configured" Error
- [ ] Check API key is set correctly
- [ ] Check environment variable name: `SUPABASE_PUBLISHABLE_KEY`
- [ ] Verify no typos in the key

### No data in Supabase
- [ ] Check browser console for errors (F12 → Console)
- [ ] Verify database tables exist in Supabase
- [ ] Check Supabase project is correct (mfydufcizonxjmgyrwkj)
- [ ] Try creating new chore to test sync

### "Cannot GET /config" errors
- [ ] If using Option B runtime config, make sure server is running
- [ ] Check file paths are correct

### Row Level Security (RLS) Blocking Access
- [ ] Go to Supabase Dashboard → Authentication → Policies
- [ ] Review or temporarily disable RLS policies if testing
- [ ] Policies in comment block are optional - only needed for multi-user auth

## For Production Deployment

See [docs/deployment.md](deployment.md) for:
- GitHub Pages deployment with Supabase
- GitHub Secrets setup
- Build scripts for injecting API keys safely

## Architecture Overview

```
┌─────────────────────┐
│   Browser App       │
├─────────────────────┤
│ localStorage (fast  │
│ + offline support)  │
└─────────┬───────────┘
          │
          ├──→ ┌──────────────────┐
          │    │ storageService   │
          │    │ (hybrid layer)   │
          └──→ │                  │
               └────────┬─────────┘
                        │
                        ├──→ ┌──────────────────┐
                        │    │ supabaseService  │
                        │    │ (cloud sync)     │
                        └──→ │                  │
                             └────────┬─────────┘
                                      │
                                      ▼
                            ┌──────────────────┐
                            │  Supabase Cloud  │
                            │  (server-side    │
                            │   storage)       │
                            └──────────────────┘
```

- **localStorage**: Stores data locally, survives page refresh, works offline
- **storageService**: Mirrors saves to both localStorage and Supabase
- **supabaseService**: Handles cloud API calls
- **Supabase**: Cloud database for permanent persistence and sharing

## Next Steps

- [ ] Test the integration with different browsers
- [ ] Set up GitHub Actions for production deployment
- [ ] Configure authentication if multi-user support needed
- [ ] Review [docs/supabase-setup.md](supabase-setup.md) for advanced options
