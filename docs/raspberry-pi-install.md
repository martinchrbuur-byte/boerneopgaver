# Install Opgavehelte on Raspberry Pi 5

This guide describes how to install Opgavehelte on a Raspberry Pi 5 so it behaves like a native app while the same app still works in normal browsers on other devices.

## What this setup gives you

- Opgavehelte installed as a Chromium app on Raspberry Pi OS
- Auto-launch after boot
- Fullscreen-ish standalone experience
- Supabase login and sync kept intact
- Same hosted app still usable from phones, tablets, and laptops

## Prerequisites

Before you start:

1. Raspberry Pi 5 with Raspberry Pi OS Desktop
2. Internet connection
3. Chromium available on the Pi
4. A hosted Opgavehelte URL
5. Your Supabase publishable key already configured in deployment

## 1. Publish the app

From the project repo:

1. Build the deployable site:
   - `npm run build`
2. Deploy the latest version using your normal GitHub Pages flow.
3. Confirm the deployed site includes:
   - `manifest.webmanifest`
   - `service-worker.js`
   - the latest app code

## 2. Prepare the Raspberry Pi

On the Raspberry Pi:

1. Update the system
2. Make sure Chromium opens normally
3. Set the Pi user to log in automatically to the desktop

## 3. Install the app on the Pi

1. Open Chromium on the Pi
2. Go to your hosted Opgavehelte URL
3. Log in with the family account
4. Use the in-app install button if shown
5. If the in-app button is not shown, use Chromium's install option from the browser UI
6. Open the installed app once and confirm:
   - it launches in its own window
   - login is still active
   - chores and sync work

## 4. Enable auto-start after boot

This repository includes helper files in [scripts/pi/setup-pi-app.sh](../scripts/pi/setup-pi-app.sh), [scripts/pi/install-autostart.sh](../scripts/pi/install-autostart.sh), and [scripts/pi/opgavehelte.desktop.template](../scripts/pi/opgavehelte.desktop.template).

### Option A: Use the one-command setup script

Run:

- `chmod +x scripts/pi/setup-pi-app.sh`
- `./scripts/pi/setup-pi-app.sh https://YOUR-APP-URL/`

This script:

- creates the autostart entry
- creates a desktop launcher
- points both to Chromium app mode

### Option B: Use the smaller autostart-only helper script

Copy the repository to the Pi or just copy the two helper files, then run:

- `chmod +x scripts/pi/install-autostart.sh`
- `./scripts/pi/install-autostart.sh https://YOUR-APP-URL/`

This writes an autostart entry to:

- `~/.config/autostart/opgavehelte.desktop`

### Option C: Create the autostart file manually

Create this file on the Pi:

- `~/.config/autostart/opgavehelte.desktop`

Use this content:

```ini
[Desktop Entry]
Type=Application
Version=1.0
Name=Opgavehelte
Comment=Start Opgavehelte automatically in Chromium app mode
Exec=/usr/bin/chromium-browser --app=https://YOUR-APP-URL/ --start-maximized --force-device-scale-factor=1 --disable-session-crashed-bubble --disable-infobars
Icon=chromium-browser
Terminal=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Categories=Education;Utility;
```

## 5. Test the startup flow

1. Reboot the Raspberry Pi
2. Wait for desktop auto-login
3. Confirm Opgavehelte opens automatically
4. Confirm the app opens in app mode, not a normal browser tab
5. Confirm data sync still works

## Troubleshooting

### Install button does not appear

Check that:

- the app is served over HTTPS
- `manifest.webmanifest` loads successfully
- `service-worker.js` loads successfully
- Chromium is using the deployed site, not a local file URL

### The app does not start after boot

Check that:

- `~/.config/autostart/opgavehelte.desktop` exists
- the `Exec=` path matches Chromium on the Pi
- the URL in `Exec=` is correct
- desktop auto-login is enabled

### The app opens but login is missing

Check that:

- cookies/session storage were not cleared
- the correct hosted URL is used every time
- Supabase auth settings allow that deployment origin

### The app loads but sync does not work

Check that:

- the Pi has internet access
- the deployed build has the correct Supabase publishable key
- Supabase is reachable from Chromium on the Pi

## Notes

- The app shell is cached locally by the service worker.
- Supabase auth and sync still require network access.
- If you change app code or browser dependencies, rebuild and redeploy before testing again.
- Use [raspberry-pi-checklist.md](raspberry-pi-checklist.md) for rollout verification.
