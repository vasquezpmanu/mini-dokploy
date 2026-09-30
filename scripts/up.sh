#!/bin/sh
set -eu

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

if [ "$(uname -s)" != "Darwin" ]; then
  fail "Mini-Dokploy's up.sh supports macOS with Docker Desktop only."
fi
if ! command -v docker >/dev/null 2>&1; then
  fail "Docker Desktop CLI is missing. Install Docker Desktop for Mac, reopen Terminal, and retry: https://docs.docker.com/desktop/setup/install/mac-install/"
fi
if ! command -v curl >/dev/null 2>&1; then
  fail "curl is missing. Install it and retry: https://curl.se/download.html"
fi
if ! command -v openssl >/dev/null 2>&1; then
  fail "openssl is missing. Install it and retry: https://www.openssl-library.org/source/"
fi
if ! command -v open >/dev/null 2>&1; then
  fail "The macOS open command is missing. Restore /usr/bin in PATH or check your macOS installation, then retry: https://support.apple.com/macos"
fi

cd "$(dirname "$0")/.."

if ! current_context=$(docker context show 2>/dev/null); then
  fail "Cannot read the Docker context. Check Docker Desktop installation and retry."
fi
if [ "$current_context" != "desktop-linux" ]; then
  fail "Select the local Docker Desktop context first: docker context use desktop-linux"
fi

if ! docker info >/dev/null 2>&1; then
  echo "Starting Docker Desktop..."
  if ! open -a Docker; then
    fail "Docker Desktop could not be opened. Install or start it manually, then retry: https://docs.docker.com/desktop/setup/install/mac-install/"
  fi
  attempts=0
  until docker info >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 90 ]; then
      echo "Docker Desktop did not become ready within 3 minutes." >&2
      exit 1
    fi
    sleep 2
  done
fi

if [ "$(docker info --format '{{.Swarm.LocalNodeState}}')" = "inactive" ]; then
  docker swarm init >/dev/null
  echo "Initialized local single-node Swarm."
fi

if ! docker network inspect mini-dokploy-public >/dev/null 2>&1; then
  docker network create --driver overlay --attachable mini-dokploy-public
fi
if ! docker volume inspect mini-dokploy-data >/dev/null 2>&1; then
  docker volume create mini-dokploy-data
fi
if ! docker secret inspect mini-dokploy-auth >/dev/null 2>&1; then
  openssl rand -base64 48 | docker secret create mini-dokploy-auth -
fi

docker build --tag mini-dokploy:local .

if docker service inspect mini-dokploy-traefik >/dev/null 2>&1; then
  docker service update --detach=false --image traefik:v3.7.13 mini-dokploy-traefik
else
  docker service create --detach=false --name mini-dokploy-traefik \
    --constraint 'node.role==manager' \
    --network mini-dokploy-public \
    --publish published=80,target=80 \
    --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock,readonly \
    traefik:v3.7.13 \
    --providers.swarm=true \
    --providers.swarm.endpoint=unix:///var/run/docker.sock \
    --providers.swarm.exposedbydefault=false \
    --providers.swarm.network=mini-dokploy-public \
    --entrypoints.web.address=:80
fi

if docker service inspect mini-dokploy-app >/dev/null 2>&1; then
  docker service update --detach=false --no-resolve-image --image mini-dokploy:local --force mini-dokploy-app
else
  docker service create --detach=false --no-resolve-image --name mini-dokploy-app \
    --constraint 'node.role==manager' \
    --network mini-dokploy-public \
    --publish published=3000,target=3000 \
    --mount type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock \
    --mount type=volume,src=mini-dokploy-data,dst=/data \
    --secret mini-dokploy-auth \
    --env DB_FILE_NAME=/data/mini-dokploy.sqlite \
    --env LOGS_DIR=/data/logs \
    --env BETTER_AUTH_URL=http://localhost:3000 \
    --env DOKPLOY_NETWORK=mini-dokploy-public \
    mini-dokploy:local
fi

echo "Waiting for Mini-Dokploy..."
attempts=0
until curl --silent --fail http://localhost:3000/ >/dev/null; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 60 ]; then
    echo "Service did not become ready. Inspect: docker service logs mini-dokploy-app" >&2
    exit 1
  fi
  sleep 2
done
echo "Ready: http://localhost:3000"
