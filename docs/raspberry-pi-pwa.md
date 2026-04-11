# Raspberry Pi 5 PWA setup

This app can now be installed as a Progressive Web App on Raspberry Pi OS while still working in ordinary browsers on other devices.

For the full setup and boot walkthrough, see [raspberry-pi-install.md](raspberry-pi-install.md).
For a short rollout checklist, see [raspberry-pi-checklist.md](raspberry-pi-checklist.md).

## Recommended setup

1. Deploy the app from the repository so the latest `dist/` output is published.
2. On the Raspberry Pi 5, open the hosted site in Chromium.
3. Log in once with the family account.
4. Use the in-app install button or Chromium's install option to install Opgavehelte.
5. Launch the installed app once to confirm it opens in standalone mode.

## Auto-start after boot

Recommended Raspberry Pi OS settings:

1. Enable desktop auto-login for the Pi user.
2. Run `scripts/pi/setup-pi-app.sh <app-url>` on the Pi to create the launcher and autostart entry.
3. Reboot and verify the app opens automatically.

## Notes

- The app shell is cached locally by the service worker.
- Supabase auth and sync still require network access.
- If installation is not offered, verify the deployed site includes `manifest.webmanifest` and `service-worker.js`.
- If you change Supabase browser dependencies, rebuild with `npm run build` before deploying.