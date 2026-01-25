#!/usr/bin/env bash
set -euo pipefail

# Everday dev helper
# - Runs frontend lint and/or builds + deploys the dev container stack.
# - Uses .env.dev with docker-compose.traefik.dev.yml.
# - Default behavior runs lint first, then build + deploy.
# - Flags allow running only lint or only build/deploy.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

lint_only=false
build_only=false

usage() {
  cat <<EOF
Usage: ./scripts/dev.sh [--lint-only] [--build-only] [--help]

Defaults to running both lint and build/deploy.

Flags:
  --lint-only   Run lint and exit (no build/deploy).
  --build-only  Build and deploy without running lint.
  --help        Show this help text.

Examples:
  ./scripts/dev.sh
  ./scripts/dev.sh --lint-only
  ./scripts/dev.sh --build-only
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lint-only)
      lint_only=true
      ;;
    --build-only)
      build_only=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ "${lint_only}" == "true" && "${build_only}" == "true" ]]; then
  echo "❌ Choose only one of --lint-only or --build-only."
  usage
  exit 1
fi

run_lint() {
  echo "Running lint checks..."
  if [[ -f "${ROOT_DIR}/frontend/package.json" ]]; then
    (cd "${ROOT_DIR}/frontend" && npm run lint)
  else
    echo "❌ Lint failed: frontend/package.json not found."
    exit 1
  fi
}

run_build() {
  echo "Building and deploying Everday dev environment..."
  echo "..."
  export VITE_APP_VERSION="$(git describe --tags --always 2>/dev/null || echo 'dev')"
  export VITE_IMAGE_TAG="$(git rev-parse --abbrev-ref HEAD)"
  export VITE_COMMIT_SHA="$(git rev-parse --short HEAD)"
  export VITE_BUILD_TIME="$(date +%s)"

  echo "..."
  docker compose --env-file "${ROOT_DIR}/.env.dev" -f "${ROOT_DIR}/docker-compose.traefik.dev.yml" up -d --build --force-recreate --remove-orphans

  echo "..."
  echo "..."
  echo "..."
  echo "📦 Version: $VITE_APP_VERSION"
  echo "📦 Branch: $VITE_IMAGE_TAG"
  echo "🔖 Commit: $VITE_COMMIT_SHA"
  echo "⏰ Build Time: $(date)"
  echo "✅ Dev environment deployed!"
  if [[ -f "${ROOT_DIR}/.env.dev" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${ROOT_DIR}/.env.dev"
    set +a
    if [[ -n "${EVERDAY_DEV_HOST:-}" ]]; then
      echo "🌐 Access at: https://${EVERDAY_DEV_HOST}"
    fi
  fi
  echo "📋 View logs: docker compose --env-file ${ROOT_DIR}/.env.dev -f ${ROOT_DIR}/docker-compose.traefik.dev.yml logs -f"
  echo "🛑 Stop: docker compose --env-file ${ROOT_DIR}/.env.dev -f ${ROOT_DIR}/docker-compose.traefik.dev.yml down"
}

if [[ "${build_only}" == "true" ]]; then
  run_build
  exit 0
fi

run_lint

if [[ "${lint_only}" == "true" ]]; then
  exit 0
fi

run_build
