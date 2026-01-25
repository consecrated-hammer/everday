#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_NAME="${1:-dev}"

if [[ ! -f "${ROOT_DIR}/.env.${ENV_NAME}" ]]; then
  echo "Missing ${ROOT_DIR}/.env.${ENV_NAME}. Copy .env.example and fill values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "${ROOT_DIR}/.env.${ENV_NAME}"
set +a

GLOBAL_ENV="/mnt/docker/config/dockerconfigs/.env"
if [[ -f "${GLOBAL_ENV}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${GLOBAL_ENV}"
  set +a
fi

case "${ENV_NAME}" in
  dev)
    SQL_CONTAINER="batserver-sql-dev"
    SA_PASSWORD="${BATSERVER_SQL_DEV_SA_PASSWORD:-${MSSQL_SA_PASSWORD:-}}"
    ;;
  prod)
    SQL_CONTAINER="batserver-sql-prod"
    SA_PASSWORD="${BATSERVER_SQL_PROD_SA_PASSWORD:-${MSSQL_SA_PASSWORD:-}}"
    ;;
  *)
    echo "Unknown environment: ${ENV_NAME} (use dev|prod)" >&2
    exit 1
    ;;
esac

if [[ -z "${SA_PASSWORD}" ]]; then
  echo "Missing SA password. Set BATSERVER_SQL_${ENV_NAME^^}_SA_PASSWORD in ${GLOBAL_ENV} or MSSQL_SA_PASSWORD in env." >&2
  exit 1
fi

APP_LOGIN_NAME="${SQLSERVER_USER_LOGIN:-everday_app}"
APP_USER_NAME="${SQLSERVER_USER_LOGIN:-everday_app}"
APP_LOGIN_PASSWORD="${SQLSERVER_USER_PASSWORD:-}"
DATABASE_NAME="${SQLSERVER_DB:-Everday}"

if [[ -z "${APP_LOGIN_PASSWORD}" ]]; then
  echo "Missing SQLSERVER_PASSWORD in .env.${ENV_NAME}." >&2
  exit 1
fi

SQL_FILE="${ROOT_DIR}/scripts/sql/bootstrap-everday.sql"
SQLCMD_PATH="/opt/mssql-tools18/bin/sqlcmd"
if ! docker exec "${SQL_CONTAINER}" test -x "${SQLCMD_PATH}" 2>/dev/null; then
  SQLCMD_PATH="/opt/mssql-tools/bin/sqlcmd"
fi
if ! docker exec "${SQL_CONTAINER}" test -x "${SQLCMD_PATH}" 2>/dev/null; then
  echo "sqlcmd not found in ${SQL_CONTAINER}. Expected /opt/mssql-tools18/bin/sqlcmd or /opt/mssql-tools/bin/sqlcmd." >&2
  exit 1
fi

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "Missing bootstrap script: ${SQL_FILE}" >&2
  exit 1
fi

echo "Bootstrapping ${DATABASE_NAME} on ${SQL_CONTAINER} (${ENV_NAME})..."
docker exec -i "${SQL_CONTAINER}" "${SQLCMD_PATH}" -C -N \
  -S localhost -U sa -P "${SA_PASSWORD}" \
  -v DatabaseName="${DATABASE_NAME}" \
  -v AppLoginName="${APP_LOGIN_NAME}" \
  -v AppUserName="${APP_USER_NAME}" \
  -v AppLoginPassword="${APP_LOGIN_PASSWORD}" \
  -i /dev/stdin < "${SQL_FILE}"

echo "Bootstrap complete."
