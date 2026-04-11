# Raspberry Pi 5 setup checklist

Use this checklist when preparing a Raspberry Pi 5 for Opgavehelte.

## Before deployment

- [ ] `npm install` has been run locally
- [ ] `npm run build` completes successfully
- [ ] The latest version is deployed
- [ ] The deployed site serves `manifest.webmanifest`
- [ ] The deployed site serves `service-worker.js`
- [ ] Supabase publishable key is configured for the deployment

## On the Raspberry Pi

- [ ] Raspberry Pi OS Desktop is installed
- [ ] Chromium is installed and opens correctly
- [ ] Internet connection works
- [ ] Desktop auto-login is enabled
- [ ] The hosted Opgavehelte URL opens in Chromium

## App install

- [ ] Open the hosted app URL in Chromium
- [ ] Log in with the family account
- [ ] Install the app using the in-app button or Chromium install UI
- [ ] Verify the app opens in its own window
- [ ] Verify chores load correctly
- [ ] Verify Supabase sync works

## Auto-start

- [ ] Run `scripts/pi/setup-pi-app.sh <app-url>` on the Pi
- [ ] Confirm `~/.config/autostart/opgavehelte.desktop` exists
- [ ] Confirm the desktop launcher exists on the Pi desktop
- [ ] Reboot the Pi
- [ ] Confirm Opgavehelte launches automatically

## Final validation

- [ ] Reboot once more to confirm startup is stable
- [ ] Confirm the session is still logged in
- [ ] Confirm data sync still works after reboot
- [ ] Confirm the app launches in app mode, not a normal browser tab
