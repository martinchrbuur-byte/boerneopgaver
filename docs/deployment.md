# Deploying to GitHub Pages with Supabase

## Current repository flow

This repository now has a real static-site build and deploy pipeline.

### Validation on pull requests

`.github/workflows/validate-pr.yml` runs:

- `npm ci`
- `node scripts/ci-secret-guard.mjs`
- `npm test`
- `npm run build`

### Deployment on `main`

`.github/workflows/deploy-pages.yml` runs:

- `npm ci`
- `node scripts/ci-secret-guard.mjs`
- `npm test`
- `npm run build`
- GitHub Pages artifact upload from `dist/`

## Build output

`npm run build` now does two things:

1. Bundles the browser Supabase dependency locally with `npm run build:vendor`
2. Creates a deployable static site in `dist/` with `npm run build:static`

The `dist/` output includes:

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `favicon.svg`
- `.nojekyll`
- `src/` including the vendored Supabase browser bundle

## Supabase publishable key handling

The browser app supports these deployment patterns:

### Option 1: Build-time injection for deploy artifacts

Set one of these environment variables before `npm run build`:

- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_ANON_KEY`

The static build injects the value into the generated `dist/src/config/supabaseConfig.js` artifact.

### Option 2: Runtime browser configuration

Set one of these in the browser context:

- `window.SUPABASE_PUBLISHABLE_KEY`
- `window.SUPABASE_ANON_KEY`
- `localStorage.setItem('SUPABASE_PUBLISHABLE_KEY', '...')`

This is useful for local testing without changing committed source files.

## Recommended deployment setup

For GitHub Pages:

1. Keep the source placeholder in `src/config/supabaseConfig.js`
2. Run `npm run build` in CI
3. Publish the `dist/` folder
4. Make sure the deployment origin is allowed in Supabase auth settings

## Local verification

Before shipping a deployment:

1. Run `npm install`
2. Run `npm test`
3. Run `npm run build`
4. Serve `dist/` or the project over `http://localhost`
5. Verify:
   - the app loads
   - `manifest.webmanifest` is reachable
   - `service-worker.js` is reachable
   - Supabase login works

Avoid relying on `file://` URLs for auth or PWA validation.
