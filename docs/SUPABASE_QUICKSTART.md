# Supabase Integration - Quick Start Checklist

Follow these steps to get data persistence working with Supabase:

## 1. Get Your API Key ✓
- [ ] Open: https://app.supabase.com/project/mfydufcizonxjmgyrwkj/settings/api
- [ ] Copy the publishable key under "Project API keys"

## 2. Set Up Publishable Key (local browser)
Choose one option:

### Option A: Runtime config in `index.html` (recommended)
- [ ] Add this before the app script:
  ```html
  <script>
    window.SUPABASE_PUBLISHABLE_KEY = 'your_publishable_key_here';
  </script>
  ```

### Option B: Persist in browser localStorage (one-time)
- [ ] Open DevTools Console
- [ ] Run:
  ```javascript
  localStorage.setItem('SUPABASE_PUBLISHABLE_KEY', 'your_publishable_key_here');
  ```

### Option C: Build-time injection (GitHub Pages)
- [ ] Set `SUPABASE_PUBLISHABLE_KEY` in GitHub repository secrets
- [ ] The deploy workflow replaces the placeholder automatically

## 3. Create Database Tables + Auth Policies
- [ ] Open your Supabase dashboard
- [ ] Go to SQL Editor
- [ ] Copy all SQL from [docs/supabase-setup.md](supabase-setup.md)
- [ ] Run the SQL in your project
- [ ] Verify tables are created (chores, records, ui_state, periods, app_settings)
- [ ] Confirm RLS policies are auth-based (`auth.uid()::text = user_id`)

## 4. Enable Auth (Email + Password)
- [ ] Go to Supabase Dashboard → Authentication → Providers
- [ ] Ensure Email provider is enabled
- [ ] Optional: disable "Confirm email" during local testing
- [ ] Keep "Confirm email" enabled in production

## 5. Confirm App Sees the Key
- [ ] Reload the app after setting the key
- [ ] If needed, run in DevTools Console:
  ```javascript
  window.SUPABASE_PUBLISHABLE_KEY
  ```
- [ ] It should return your publishable key (not `undefined` and not the placeholder)

## 6. Test the Integration
- [ ] Install dependencies: `npm install`
- [ ] Start your dev server or open index.html
- [ ] Open browser DevTools (F12)
- [ ] Check Console tab for "Connected to Supabase" message
- [ ] Use app landing page to create account or log in
- [ ] Create/complete a chore
- [ ] Verify data appears in your Supabase database
  - Go to Supabase Dashboard → your project
  - Check the Tables tab for data

## 7. Verify Data Sync
- [ ] Data appears in Supabase `chores` table
- [ ] Data appears in Supabase `records` table
- [ ] Data appears in Supabase `ui_state` table
- [ ] Refresh page - data persists from Supabase

## Troubleshooting

### "Supabase is not configured" Error
- [ ] Check API key is set correctly
- [ ] Check `window.SUPABASE_PUBLISHABLE_KEY` or localStorage key `SUPABASE_PUBLISHABLE_KEY`
- [ ] Verify the key is not the placeholder value

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
- [ ] Verify every policy uses `auth.uid()::text = user_id`
- [ ] Do not use public `USING (true)` policies in production

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
