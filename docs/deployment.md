# Deploying to GitHub Pages with Supabase

## Current Automated Flow (Repository Standard)

This repository now uses a gated GitHub Actions flow:

1. PR opened against `main` runs validation in `.github/workflows/validate-pr.yml`.
2. Required checks:
  - `npm test`
  - `npm run token:gate`
  - `npm run ci:secret-guard`
3. After PR merge to `main`, `.github/workflows/deploy-pages.yml` runs.
4. Deploy workflow re-runs the same gates, auto-commits tracked changes (if any), then publishes to GitHub Pages.

### Secret Safety Rules

- Tracked `.env` files are blocked.
- Obvious hardcoded secrets in tracked files are blocked.
- Keep Supabase publishable key in GitHub Actions secrets as `SUPABASE_PUBLISHABLE_KEY`.

Since this is a static HTML/JavaScript app (no build step), there are a few approaches to handle environment variables:

## Option 1: GitHub Secrets + Build Script (Recommended)

1. **Create a build script** - Add to `package.json`:
   ```json
   {
     "scripts": {
       "build": "node scripts/build.js",
       "test": "node --test"
     }
   }
   ```

2. **Create `scripts/build.js`:**
   ```javascript
   import fs from 'fs';
   import path from 'path';
   import { fileURLToPath } from 'url';

   const __dirname = path.dirname(fileURLToPath(import.meta.url));
   const srcPath = path.join(__dirname, '..', 'src', 'config', 'supabaseConfig.js');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

   const configContent = `export const SUPABASE_CONFIG = {
     url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
     publishableKey: '${publishableKey}'
   };

   export function isSupabaseConfigured() {
     return SUPABASE_CONFIG.publishableKey.length > 0;
   }
   `;

   fs.writeFileSync(srcPath, configContent, 'utf8');
   console.log('Supabase config generated successfully');
   ```

3. **Add GitHub Actions Workflow** - Create `.github/workflows/setup-supabase.yml`:
   ```yaml
   name: Setup Supabase Config

   on:
     push:
       branches:
         - main
     workflow_dispatch:

   jobs:
     setup:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         
         - name: Setup Node.js
           uses: actions/setup-node@v3
           with:
             node-version: '18'
         
         - name: Generate Supabase config
           env:
             SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}
           run: node scripts/build.js
         
         - name: Commit and push
           run: |
             git config --local user.email "action@github.com"
             git config --local user.name "GitHub Action"
             git add src/config/supabaseConfig.js
             git commit -m "Update Supabase config" || true
             git push
   ```

4. **Add the secret to GitHub:**
   - Go to your repo → Settings → Secrets and variables → Actions
  - Create `SUPABASE_PUBLISHABLE_KEY` with your client key

## Option 2: Manual Configuration (Simple)

1. Get your publishable key from: https://app.supabase.com/project/mfydufcizonxjmgyrwkj/settings/api

2. Edit `src/config/supabaseConfig.js` directly:
   ```javascript
   export const SUPABASE_CONFIG = {
     url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
     publishableKey: 'your_actual_key_here'
   };
   ```

3. **WARNING**: Never commit this to public repos! Use your .gitignore properly.

## Option 3: Runtime Configuration (Advanced)

Create a configuration endpoint or load from a separate config file:

```javascript
// Load config from config.json
const response = await fetch('/config.json');
const config = await response.json();
SUPABASE_CONFIG.publishableKey = config.supabase_publishable_key;
```

Then host `config.json` separately, only on deployed environments.

## Testing Locally

For local development without committing API keys:

1. Create a local `.env` file (already in .gitignore)
2. Create a small dev server:
   ```bash
   npm install express cors dotenv
   ```

3. Create `server.js`:
   ```javascript
   import express from 'express';
   import cors from 'cors';
   import dotenv from 'dotenv';
   import { fileURLToPath } from 'url';
   import path from 'path';

   dotenv.config();

   const __dirname = path.dirname(fileURLToPath(import.meta.url));
   const app = express();

   app.use(cors());
   app.use(express.static('.'));

   app.get('/api/config', (req, res) => {
     res.json({
       supabase_publishable_key: process.env.SUPABASE_PUBLISHABLE_KEY || ''
     });
   });

   app.listen(3000, () => console.log('Server running on http://localhost:3000'));
   ```

4. Load config in your app:
   ```javascript
   if (typeof window !== 'undefined' && location.hostname === 'localhost') {
     const config = await fetch('/api/config').then(r => r.json());
     SUPABASE_CONFIG.publishableKey = config.supabase_publishable_key;
   }
   ```

## Which Option to Use?

- **Option 1**: Best for production GitHub Pages deployment
- **Option 2**: Quickest for getting started (use .env to prevent accidents)
- **Option 3**: Most secure, requires additional infrastructure
