#!/usr/bin/env sh
# Validate a configured Supabase environment before enabling recipe import.
#
# This preflight checks the HTTP and database surfaces before deployment. When
# no preflight environment is configured it reports a safe skip. Once any
# preflight value is supplied, incomplete configuration or any failed probe
# exits non-zero.

set -eu

configured=0
for value in \
  "${SUPABASE_PREFLIGHT_URL:-}" \
  "${SUPABASE_PREFLIGHT_ANON_KEY:-}" \
  "${SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY:-}" \
  "${SUPABASE_PREFLIGHT_DB_URL:-}" \
  "${SUPABASE_PREFLIGHT_ORIGIN:-}" \
  "${SUPABASE_PREFLIGHT_QUEUE_ENABLED:-}" \
  "${SUPABASE_PREFLIGHT_QUEUE_READY:-}" \
  "${SUPABASE_PREFLIGHT_WORKER_TOKEN:-}"; do
  [ -z "$value" ] || configured=1
done

if [ "$configured" -eq 0 ]; then
  printf '%s\n' "SKIP: no Supabase preflight environment is configured."
  exit 0
fi

fail() {
  printf 'SUPABASE PREFLIGHT FAIL: %s\n' "$*" >&2
  exit 1
}

: "${SUPABASE_PREFLIGHT_URL:?SUPABASE_PREFLIGHT_URL is required when preflight is configured}" \
  || fail "SUPABASE_PREFLIGHT_URL is required when preflight is configured"
: "${SUPABASE_PREFLIGHT_ANON_KEY:?SUPABASE_PREFLIGHT_ANON_KEY is required when preflight is configured}" \
  || fail "SUPABASE_PREFLIGHT_ANON_KEY is required when preflight is configured"
: "${SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY:?SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY is required when preflight is configured}" \
  || fail "SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY is required when preflight is configured"
: "${SUPABASE_PREFLIGHT_DB_URL:?SUPABASE_PREFLIGHT_DB_URL is required when preflight is configured}" \
  || fail "SUPABASE_PREFLIGHT_DB_URL is required when preflight is configured"
: "${SUPABASE_PREFLIGHT_ORIGIN:?SUPABASE_PREFLIGHT_ORIGIN is required when preflight is configured}" \
  || fail "SUPABASE_PREFLIGHT_ORIGIN is required when preflight is configured"
: "${SUPABASE_PREFLIGHT_WORKER_TOKEN:?SUPABASE_PREFLIGHT_WORKER_TOKEN is required when preflight is configured}" \
  || fail "SUPABASE_PREFLIGHT_WORKER_TOKEN is required when preflight is configured"
: "${SUPABASE_PREFLIGHT_QUEUE_ENABLED:?SUPABASE_PREFLIGHT_QUEUE_ENABLED must be true or false}" \
  || fail "SUPABASE_PREFLIGHT_QUEUE_ENABLED must be true or false"

case "$SUPABASE_PREFLIGHT_URL" in
  https://*.supabase.co) ;;
  *) fail "SUPABASE_PREFLIGHT_URL must use https://<project>.supabase.co" ;;
esac

case "$SUPABASE_PREFLIGHT_ORIGIN" in
  http://localhost:*|http://127.0.0.1:*|https://*) ;;
  *) fail "SUPABASE_PREFLIGHT_ORIGIN must be an http(s) origin" ;;
esac

case "$SUPABASE_PREFLIGHT_QUEUE_ENABLED" in
  true|false) ;;
  *) fail "SUPABASE_PREFLIGHT_QUEUE_ENABLED must be exactly true or false" ;;
esac

tmp=$(mktemp -d 2>/dev/null || mktemp -d -t pantrypilot-preflight)
cleanup() { rm -rf "$tmp"; }
trap cleanup EXIT INT TERM

recipe_url="$SUPABASE_PREFLIGHT_URL/functions/v1/recipe-import"
worker_url="$SUPABASE_PREFLIGHT_URL/functions/v1/recipe-import-worker"

options_status=$(curl --silent --show-error --dump-header "$tmp/options-headers" --output /dev/null --write-out '%{http_code}' \
  -X OPTIONS "$recipe_url" \
  -H "Origin: $SUPABASE_PREFLIGHT_ORIGIN" \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization, apikey, content-type') \
  || fail "recipe-import CORS preflight request failed"
[ "$options_status" = "200" ] || fail "recipe-import CORS preflight returned HTTP $options_status, expected 200"
grep -F -qi "access-control-allow-origin: $SUPABASE_PREFLIGHT_ORIGIN" "$tmp/options-headers" \
  || fail "recipe-import CORS response did not allow the configured origin"
grep -F -qi 'access-control-allow-methods: POST, OPTIONS' "$tmp/options-headers" \
  || fail "recipe-import CORS response did not advertise POST and OPTIONS"

recipe_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  -X POST "$recipe_url" \
  -H "apikey: $SUPABASE_PREFLIGHT_ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"importId":"preflight-unauthenticated"}') \
  || fail "recipe-import authentication probe failed"
[ "$recipe_status" = "401" ] || fail "recipe-import returned HTTP $recipe_status for an unauthenticated request, expected 401"

worker_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  -X POST "$worker_url" \
  -H "apikey: $SUPABASE_PREFLIGHT_ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data '{}') \
  || fail "recipe-import-worker authentication probe failed"
[ "$worker_status" = "401" ] || fail "recipe-import-worker returned HTTP $worker_status for an unauthenticated request, expected 401"

bucket_response=$(curl --silent --show-error --fail \
  "$SUPABASE_PREFLIGHT_URL/storage/v1/bucket/recipe-imports" \
  -H "apikey: $SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY") \
  || fail "private recipe-imports bucket is missing or inaccessible with the service role"
printf '%s' "$bucket_response" | grep -Fq '"public":false' \
  || fail "recipe-imports bucket must be private"

curl --silent --show-error --fail --output /dev/null \
  "$SUPABASE_PREFLIGHT_URL/rest/v1/recipe_imports?select=id&limit=0" \
  -H "apikey: $SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY" \
  || fail "recipe_imports migration is not applied or is not reachable"

command -v psql >/dev/null 2>&1 \
  || fail "PostgreSQL client is required for database-level preflight verification"
command -v python3 >/dev/null 2>&1 \
  || fail "Python 3 is required for database-level preflight verification"
pgpass="$tmp/pgpass"
pgparams="$tmp/pgparams"
old_umask=$(umask)
umask 077
printf '%s' "$SUPABASE_PREFLIGHT_DB_URL" | python3 -c '
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

url = sys.stdin.read()
parsed = urlsplit(url)
if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname or not parsed.username or parsed.password is None:
    raise SystemExit("invalid PostgreSQL connection URL")

host = parsed.hostname
port = parsed.port or 5432
database = parsed.path.lstrip("/") or "postgres"
user = unquote(parsed.username)
password = unquote(parsed.password).replace("\\", "\\\\").replace(":", "\\:")
Path(sys.argv[1]).write_text(f"{host}:{port}:{database}:{user}:{password}\\n")
Path(sys.argv[2]).write_text(f"{host}\\n{port}\\n{database}\\n{user}\\n")
' "$pgpass" "$pgparams" \
  || fail "invalid PostgreSQL connection URL"
chmod 600 "$pgpass"
umask "$old_umask"
IFS= read -r db_host < "$pgparams"
db_port=$(sed -n '2p' "$pgparams")
db_name=$(sed -n '3p' "$pgparams")
db_user=$(sed -n '4p' "$pgparams")
db_check=$(PGPASSFILE="$pgpass" psql \
  "host=$db_host" "port=$db_port" "dbname=$db_name" "user=$db_user" \
  sslmode=require --tuples-only --no-align --command \
  "select json_build_object('recipe_imports', to_regclass('public.recipe_imports') is not null, 'migration_set', case when to_regclass('supabase_migrations.schema_migrations') is null then false else (select count(*) = 7 from supabase_migrations.schema_migrations where version in ('20261120000000','20261120000100','20261120000200','20261120000300','20261120000400','20261120000500','20261120000600')) end, 'provider_schema', (select count(*) = 6 from information_schema.columns where table_schema = 'public' and table_name = 'recipe_imports' and column_name in ('draft_json','confidence_json','warnings_json','error_code','attempt_count','provider_request_id')), 'import_policies', (select count(*) >= 2 from pg_policies where schemaname = 'public' and tablename = 'recipe_imports'), 'storage_policies', (select count(*) >= 3 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%recipe import%'), 'pgmq', to_regclass('pgmq.q_recipe_imports') is not null, 'pg_cron', to_regclass('cron.job') is not null, 'worker_schedule', case when to_regclass('cron.job') is null then false else exists (select 1 from cron.job where jobname = 'recipe-import-worker') end, 'cleanup_schedule', case when to_regclass('cron.job') is null then false else exists (select 1 from cron.job where jobname = 'recipe-import-source-cleanup') end, 'vault', to_regclass('vault.decrypted_secrets') is not null) as checks;" 2>/dev/null) \
  || fail "database-level preflight query failed"
printf '%s' "$db_check" | grep -Fq '"recipe_imports":true' \
  || fail "recipe_imports table is missing"
printf '%s' "$db_check" | grep -Fq '"migration_set":true' \
  || fail "recipe-import migration set is incomplete"
printf '%s' "$db_check" | grep -Fq '"provider_schema":true' \
  || fail "recipe-import provider schema is incomplete"
printf '%s' "$db_check" | grep -Fq '"import_policies":true' \
  || fail "recipe-import RLS policies are incomplete"
printf '%s' "$db_check" | grep -Fq '"storage_policies":true' \
  || fail "recipe-import Storage policies are incomplete"
printf '%s' "$db_check" | grep -Fq '"pgmq":true' \
  || fail "pgmq queue is missing"
if [ "$SUPABASE_PREFLIGHT_QUEUE_ENABLED" = "true" ]; then
  printf '%s' "$db_check" | grep -Fq '"worker_schedule":true' \
    || fail "queue mode is enabled but the worker schedule is missing"
  printf '%s' "$db_check" | grep -Fq '"cleanup_schedule":true' \
    || fail "queue mode is enabled but the cleanup schedule is missing"
fi

provider_ready=$(curl --silent --show-error --output "$tmp/provider" --write-out '%{http_code}' \
  -X POST "$worker_url" \
  -H "apikey: $SUPABASE_PREFLIGHT_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_PREFLIGHT_WORKER_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"preflight":true}') \
  || fail "provider configuration probe failed"
[ "$provider_ready" = "200" ] || fail "GEMINI_API_KEY is not configured in the worker environment"
grep -Fq '"providerConfigured":true' "$tmp/provider" \
  || fail "provider configuration probe did not confirm Gemini readiness"

if [ "$SUPABASE_PREFLIGHT_QUEUE_ENABLED" = "true" ]; then
  [ "${SUPABASE_PREFLIGHT_QUEUE_READY:-false}" = "true" ] \
    || fail "queue mode cannot be enabled unless SUPABASE_PREFLIGHT_QUEUE_READY=true"
  [ -n "${SUPABASE_PREFLIGHT_WORKER_TOKEN:-}" ] \
    || fail "SUPABASE_PREFLIGHT_WORKER_TOKEN is required when queue mode is enabled"
  worker_ready=$(curl --silent --show-error --output "$tmp/worker" --write-out '%{http_code}' \
    -X POST "$worker_url" \
    -H "apikey: $SUPABASE_PREFLIGHT_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_PREFLIGHT_WORKER_TOKEN" \
    -H 'Content-Type: application/json' \
    --data '{}') \
    || fail "authenticated recipe-import-worker probe failed"
  [ "$worker_ready" = "200" ] \
    || fail "queue mode is enabled but recipe-import-worker returned HTTP $worker_ready; inspect the worker response and queue configuration"
  printf '%s\n' "Queue worker authenticated successfully."
else
  printf '%s\n' "Queue mode is disabled; worker readiness is not required."
fi

printf '%s\n' "Supabase preflight passed: CORS, authentication boundaries, and configured queue mode are healthy."
