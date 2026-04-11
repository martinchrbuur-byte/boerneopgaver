#!/usr/bin/env bash
set -euo pipefail

APP_URL="${1:-}"
PI_USER="${SUDO_USER:-${USER:-pi}}"
PI_HOME="$(getent passwd "${PI_USER}" | cut -d: -f6 2>/dev/null || true)"
CHROMIUM_BIN=""
AUTOSTART_DIR=""
DESKTOP_DIR=""
LAUNCHER_PATH=""
AUTOSTART_PATH=""

if [[ -z "${APP_URL}" ]]; then
  echo "Usage: ./scripts/pi/setup-pi-app.sh <app-url>"
  echo "Example: ./scripts/pi/setup-pi-app.sh https://your-site.example/"
  exit 1
fi

if [[ -z "${PI_HOME}" ]]; then
  echo "Could not resolve home directory for user: ${PI_USER}"
  exit 1
fi

if command -v chromium-browser >/dev/null 2>&1; then
  CHROMIUM_BIN="$(command -v chromium-browser)"
elif command -v chromium >/dev/null 2>&1; then
  CHROMIUM_BIN="$(command -v chromium)"
else
  echo "Chromium was not found. Install Chromium first."
  exit 1
fi

AUTOSTART_DIR="${PI_HOME}/.config/autostart"
DESKTOP_DIR="${PI_HOME}/Desktop"
LAUNCHER_PATH="${DESKTOP_DIR}/Opgavehelte.desktop"
AUTOSTART_PATH="${AUTOSTART_DIR}/opgavehelte.desktop"
EXEC_LINE="${CHROMIUM_BIN} --app=${APP_URL} --start-maximized --force-device-scale-factor=1 --disable-session-crashed-bubble --disable-infobars"

mkdir -p "${AUTOSTART_DIR}" "${DESKTOP_DIR}"

create_launcher() {
  local target_path="$1"
  cat > "${target_path}" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Opgavehelte
Comment=Start Opgavehelte in Chromium app mode
Exec=${EXEC_LINE}
Icon=chromium-browser
Terminal=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
Categories=Education;Utility;
EOF
  chmod 755 "${target_path}"
}

create_launcher "${AUTOSTART_PATH}"
create_launcher "${LAUNCHER_PATH}"
chown "${PI_USER}:${PI_USER}" "${AUTOSTART_PATH}" "${LAUNCHER_PATH}" 2>/dev/null || true

cat <<EOF
Opgavehelte setup complete.

Created:
- ${AUTOSTART_PATH}
- ${LAUNCHER_PATH}

Next steps:
1. Enable desktop auto-login for user '${PI_USER}' if it is not already enabled.
2. Open Chromium once and sign in to Opgavehelte at: ${APP_URL}
3. Reboot the Raspberry Pi to verify auto-start.
EOF
