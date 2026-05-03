#!/usr/bin/env bash
set -euo pipefail

PI_USER="${SUDO_USER:-${USER:-pi}}"
PI_HOME="$(getent passwd "${PI_USER}" | cut -d: -f6 2>/dev/null || true)"
SPEAKER_MATCH=""
ATTEMPTS="45"
INTERVAL_SECONDS="2"
INSTALL_PACKAGES="false"
SERVICE_NAME="opgavehelte-airplay-default.service"

print_usage() {
  cat <<EOF
Usage: ./scripts/pi/setup-airplay-autostart.sh [options]

Options:
  --speaker <name-part>      Prefer AirPlay sink containing this text
  --attempts <number>        Discovery attempts at login (default: 45)
  --interval <seconds>       Delay between attempts (default: 2)
  --user <username>          Target desktop user (default: current user)
  --install-packages         Install pulseaudio/raop/avahi packages
  -h, --help                 Show this help

Examples:
  ./scripts/pi/setup-airplay-autostart.sh --speaker "Stue"
  sudo ./scripts/pi/setup-airplay-autostart.sh --install-packages --speaker "HomePod"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --speaker)
      SPEAKER_MATCH="${2:-}"
      shift 2
      ;;
    --attempts)
      ATTEMPTS="${2:-}"
      shift 2
      ;;
    --interval)
      INTERVAL_SECONDS="${2:-}"
      shift 2
      ;;
    --user)
      PI_USER="${2:-}"
      shift 2
      ;;
    --install-packages)
      INSTALL_PACKAGES="true"
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      print_usage
      exit 1
      ;;
  esac
done

if ! [[ "${ATTEMPTS}" =~ ^[0-9]+$ ]] || [[ "${ATTEMPTS}" -lt 1 ]]; then
  echo "--attempts must be a positive integer."
  exit 1
fi

if ! [[ "${INTERVAL_SECONDS}" =~ ^[0-9]+$ ]]; then
  echo "--interval must be a non-negative integer."
  exit 1
fi

PI_HOME="$(getent passwd "${PI_USER}" | cut -d: -f6 2>/dev/null || true)"
if [[ -z "${PI_HOME}" ]]; then
  echo "Could not resolve home directory for user: ${PI_USER}"
  exit 1
fi

run_as_user() {
  local command="$1"
  if [[ "$(id -un)" == "${PI_USER}" ]]; then
    bash -lc "${command}"
    return
  fi

  if command -v sudo >/dev/null 2>&1; then
    sudo -u "${PI_USER}" bash -lc "${command}"
    return
  fi

  su - "${PI_USER}" -c "${command}"
}

if [[ "${INSTALL_PACKAGES}" == "true" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "--install-packages requires root (run with sudo)."
    exit 1
  fi

  apt-get update
  apt-get install -y pulseaudio pulseaudio-module-raop avahi-daemon
  systemctl enable --now avahi-daemon
fi

USER_BIN_DIR="${PI_HOME}/.local/bin"
USER_SYSTEMD_DIR="${PI_HOME}/.config/systemd/user"
SELECT_SCRIPT_PATH="${USER_BIN_DIR}/opgavehelte-select-airplay-sink.sh"
SERVICE_PATH="${USER_SYSTEMD_DIR}/${SERVICE_NAME}"

mkdir -p "${USER_BIN_DIR}" "${USER_SYSTEMD_DIR}"

cat > "${SELECT_SCRIPT_PATH}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

SPEAKER_MATCH="${SPEAKER_MATCH:-}"
ATTEMPTS="${ATTEMPTS:-45}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-2}"

ensure_raop_discovery() {
  if pactl list short modules 2>/dev/null | awk '$2 == "module-raop-discover" { found = 1 } END { exit !found }'; then
    return
  fi

  pactl load-module module-raop-discover >/dev/null 2>&1 || true
}

find_sink() {
  local match_lc="${SPEAKER_MATCH,,}"

  if [[ -n "${match_lc}" ]]; then
    pactl list short sinks 2>/dev/null \
      | awk -v match="${match_lc}" 'tolower($2) ~ /^raop_(output|sink)\./ && tolower($0) ~ match { print $2; exit }'
    return
  fi

  pactl list short sinks 2>/dev/null \
    | awk 'tolower($2) ~ /^raop_(output|sink)\./ { print $2; exit }'
}

move_active_audio() {
  local sink_name="$1"
  pactl list short sink-inputs 2>/dev/null | awk '{print $1}' | while read -r input_id; do
    pactl move-sink-input "${input_id}" "${sink_name}" >/dev/null 2>&1 || true
  done
}

ensure_raop_discovery

for ((attempt = 1; attempt <= ATTEMPTS; attempt++)); do
  sink_name="$(find_sink || true)"
  if [[ -n "${sink_name}" ]]; then
    pactl set-default-sink "${sink_name}"
    move_active_audio "${sink_name}"
    echo "Selected AirPlay sink: ${sink_name}"
    exit 0
  fi

  sleep "${INTERVAL_SECONDS}"
done

echo "No AirPlay sink found after ${ATTEMPTS} attempts."
exit 1
EOF

cat > "${SERVICE_PATH}" <<EOF
[Unit]
Description=Set default PulseAudio sink to AirPlay RAOP
After=default.target network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=SPEAKER_MATCH=${SPEAKER_MATCH}
Environment=ATTEMPTS=${ATTEMPTS}
Environment=INTERVAL_SECONDS=${INTERVAL_SECONDS}
ExecStart=%h/.local/bin/opgavehelte-select-airplay-sink.sh
RemainAfterExit=true

[Install]
WantedBy=default.target
EOF

chmod 755 "${SELECT_SCRIPT_PATH}"
chmod 644 "${SERVICE_PATH}"
chown "${PI_USER}:${PI_USER}" "${SELECT_SCRIPT_PATH}" "${SERVICE_PATH}" 2>/dev/null || true

run_as_user "systemctl --user daemon-reload"
if run_as_user "systemctl --user enable --now ${SERVICE_NAME}"; then
  SERVICE_STATUS="enabled"
else
  SERVICE_STATUS="needs-session"
fi

cat <<EOF
AirPlay autostart setup complete.

Created:
- ${SELECT_SCRIPT_PATH}
- ${SERVICE_PATH}

Service:
- ${SERVICE_NAME} (${SERVICE_STATUS})

If service state is 'needs-session', log into the desktop as '${PI_USER}' and run:
  systemctl --user daemon-reload
  systemctl --user enable --now ${SERVICE_NAME}

Quick test now:
  sudo -u ${PI_USER} ${SELECT_SCRIPT_PATH}
EOF
