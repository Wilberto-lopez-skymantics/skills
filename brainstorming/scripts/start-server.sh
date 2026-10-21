#!/usr/bin/env bash
# Start the SDD Visual Companion server and output connection info
# Usage: start-server.sh [--project-dir <path>] [--port <n>] [--detach] [--host <bind-host>] [--url-host <display-host>] [--foreground] [--background]
#
# Starts server on a random high port, outputs JSON with URL.
# Each session gets its own directory to avoid conflicts.
#
# Options:
#   --project-dir <path>  Store session files under <path>/specs/brainstorming/
#                         instead of /tmp. Files persist after server stops.
#   --host <bind-host>    Host/interface to bind (default: 127.0.0.1).
#                         Use 0.0.0.0 in remote/containerized environments.
#   --url-host <host>     Hostname shown in returned URL JSON.
#   --port <n>            Bind this port. With --project-dir the last port is reused by default, so a
#                         restart comes back on the same URL (recorded in specs/brainstorming/current-server.json).
#   --detach              Do not stop when the starting process exits (idle timeout still applies).
#                         Use it when the server outlives the agent that starts it (Stage 03 authors).
#   --foreground          Run server in the current terminal (no backgrounding).
#   --background          Force background mode (overrides Codex auto-foreground).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
PROJECT_DIR=""
PORT_ARG=""
DETACH="false"
FOREGROUND="false"
FORCE_BACKGROUND="false"
BIND_HOST="127.0.0.1"
URL_HOST=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --host)
      BIND_HOST="$2"
      shift 2
      ;;
    --port)
      PORT_ARG="$2"
      shift 2
      ;;
    --detach)
      DETACH="true"
      shift
      ;;
    --url-host)
      URL_HOST="$2"
      shift 2
      ;;
    --foreground|--no-daemon)
      FOREGROUND="true"
      shift
      ;;
    --background|--daemon)
      FORCE_BACKGROUND="true"
      shift
      ;;
    *)
      echo "{\"error\": \"Unknown argument: $1\"}"
      exit 1
      ;;
  esac
done

if [[ -z "$URL_HOST" ]]; then
  if [[ "$BIND_HOST" == "127.0.0.1" || "$BIND_HOST" == "localhost" ]]; then
    URL_HOST="localhost"
  else
    URL_HOST="$BIND_HOST"
  fi
fi

# Some environments reap detached/background processes. Auto-foreground when detected.
if [[ -n "${CODEX_CI:-}" && "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  FOREGROUND="true"
fi

# Windows/Git Bash reaps nohup background processes. Auto-foreground when detected.
if [[ "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  case "${OSTYPE:-}" in
    msys*|cygwin*|mingw*) FOREGROUND="true" ;;
  esac
  if [[ -n "${MSYSTEM:-}" ]]; then
    FOREGROUND="true"
  fi
fi

# One server per project: if the recorded server is still alive, hand back its URL instead of starting
# a second one on another port (authors kept citing a dead URL after a restart).
CURRENT_FILE=""
if [[ -n "$PROJECT_DIR" ]]; then
  mkdir -p "${PROJECT_DIR}/specs/brainstorming"
  CURRENT_FILE="${PROJECT_DIR}/specs/brainstorming/current-server.json"
  if [[ -f "$CURRENT_FILE" ]]; then
    cur_pid="$(sed -n 's/.*"pid": *\([0-9][0-9]*\).*/\1/p' "$CURRENT_FILE" | head -1)"
    # The pid must still be this companion server (pids are reused after a reboot).
    if [[ -n "$cur_pid" ]] && kill -0 "$cur_pid" 2>/dev/null && ps -p "$cur_pid" -o command= 2>/dev/null | grep -q 'server.cjs'; then
      sed 's/}$/, "reused": true}/' "$CURRENT_FILE"
      exit 0
    fi
    if [[ -z "$PORT_ARG" ]]; then
      PORT_ARG="$(sed -n 's/.*"port": *\([0-9][0-9]*\).*/\1/p' "$CURRENT_FILE" | head -1)"
    fi
  fi
fi

# Generate unique session directory
SESSION_ID="$$-$(date +%s)"

if [[ -n "$PROJECT_DIR" ]]; then
  SESSION_DIR="${PROJECT_DIR}/specs/brainstorming/${SESSION_ID}"
else
  SESSION_DIR="/tmp/brainstorm-${SESSION_ID}"
fi

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"
LOG_FILE="${STATE_DIR}/server.log"

# Create fresh session directory with content and state peers
mkdir -p "${SESSION_DIR}/content" "$STATE_DIR"

cd "$SCRIPT_DIR"

# Resolve the harness PID (grandparent of this script).
# $PPID is the ephemeral shell the harness spawned to run us — it dies
# when this script exits. The harness itself is $PPID's parent.
OWNER_PID="$(ps -o ppid= -p "$PPID" 2>/dev/null | tr -d ' ')"
if [[ -z "$OWNER_PID" || "$OWNER_PID" == "1" ]]; then
  OWNER_PID="$PPID"
fi
if [[ "$DETACH" == "true" ]]; then
  OWNER_PID=""
fi

# Foreground mode for environments that reap detached/background processes.
if [[ "$FOREGROUND" == "true" ]]; then
  # exec keeps the PID written below pointing at the node process itself.
  echo "$$" > "$PID_FILE"
  exec env BRAINSTORM_PORT="$PORT_ARG" BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_PROJECT_DIR="$PROJECT_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs
fi

# Start server, capturing output to log file
# Use nohup to survive shell exit; disown to remove from job table
launch() {
  nohup env BRAINSTORM_PORT="$1" BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_PROJECT_DIR="$PROJECT_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs > "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null
  echo "$SERVER_PID" > "$PID_FILE"
}
launch "$PORT_ARG"

# Wait for server-started message (check log file)
for i in {1..50}; do
  if grep -q "port-in-use" "$LOG_FILE" 2>/dev/null; then
    # The remembered port is taken by something else: fall back to a random port and say so.
    launch ""
    PORT_CHANGED="true"
    continue
  fi
  if grep -q "server-started" "$LOG_FILE" 2>/dev/null; then
    # Verify server is still alive after a short window (catches process reapers)
    alive="true"
    for _ in {1..20}; do
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        alive="false"
        break
      fi
      sleep 0.1
    done
    if [[ "$alive" != "true" ]]; then
      echo "{\"error\": \"Server started but was killed. Retry in a persistent terminal with: $SCRIPT_DIR/start-server.sh${PROJECT_DIR:+ --project-dir $PROJECT_DIR} --host $BIND_HOST --url-host $URL_HOST --foreground\"}"
      exit 1
    fi
    line="$(grep "server-started" "$LOG_FILE" | head -1)"
    if [[ "${PORT_CHANGED:-}" == "true" ]]; then
      echo "$line" | sed 's/}$/, "port_changed": true}/'
    else
      echo "$line"
    fi
    exit 0
  fi
  sleep 0.1
done

# Timeout - server didn't start
echo '{"error": "Server failed to start within 5 seconds"}'
exit 1
