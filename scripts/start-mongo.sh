#!/usr/bin/env bash
# Ensure the local MongoDB Docker container is up before `next dev`.
# Wired as the npm "predev" hook (npm runs it automatically before `dev`).
# Soft-fails: always exits 0 so `next dev` still starts (Mongoose retries).
#
# Requires bash (Linux / macOS / WSL). On a machine where Docker needs elevated
# privileges you'll be prompted for your password; to avoid that, add yourself
# to the `docker` group once: `sudo usermod -aG docker $USER` then re-login.
set -uo pipefail

CONTAINER="learnpath-mongo"
IMAGE="mongo:7"
PORT="27017"

note() { printf '\033[36m[db]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[db]\033[0m %s\n' "$*" >&2; }

# Skip Docker entirely if the configured DB isn't local (e.g. Atlas).
if [ -f .env.local ]; then
  uri="$(grep -E '^MONGODB_URI=' .env.local | head -1 | cut -d= -f2-)"
  case "$uri" in
    *localhost*|*127.0.0.1*|"") : ;; # local → manage the container
    *) note "MONGODB_URI is not local — skipping Docker startup."; exit 0 ;;
  esac
fi

if ! command -v docker >/dev/null 2>&1; then
  warn "Docker not found — start MongoDB yourself or point MONGODB_URI at a running instance."
  exit 0
fi

# Prefer calling docker without sudo; fall back to sudo if the daemon socket
# isn't accessible to the current user.
if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  DOCKER="sudo docker"
  note "docker needs elevated privileges; you may be prompted for your password."
fi

if ! $DOCKER info >/dev/null 2>&1; then
  warn "Docker daemon not reachable. Start it (e.g. 'sudo systemctl start docker') and retry."
  exit 0
fi

# Ensure the container exists and is running.
if $DOCKER ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  note "$CONTAINER already running."
elif $DOCKER ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  note "starting existing $CONTAINER…"
  $DOCKER start "$CONTAINER" >/dev/null
else
  note "creating $CONTAINER ($IMAGE) on port $PORT…"
  $DOCKER run -d --name "$CONTAINER" -p "$PORT:$PORT" "$IMAGE" >/dev/null
fi

# Wait until the port accepts connections (bash /dev/tcp).
for _ in $(seq 1 30); do
  if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
    exec 3>&- 3<&- 2>/dev/null || true
    note "MongoDB ready on $PORT."
    exit 0
  fi
  sleep 1
done
warn "MongoDB port $PORT not reachable after 30s (continuing; Mongoose will retry)."
exit 0
