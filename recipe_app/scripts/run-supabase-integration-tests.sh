#!/usr/bin/env sh
# Conditional live-project smoke scaffolding. It is intentionally a no-op when
# a dedicated Supabase test project has not been configured.

set -eu

if [ -z "${SUPABASE_TEST_URL:-}" ] && [ -z "${SUPABASE_TEST_ANON_KEY:-}" ]; then
  printf '%s\n' "SKIP: no Supabase test environment is configured."
  exit 0
fi

if [ -z "${SUPABASE_TEST_URL:-}" ] || [ -z "${SUPABASE_TEST_ANON_KEY:-}" ]; then
  printf '%s\n' "Supabase integration smoke requires both SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY." >&2
  exit 1
fi

case "$SUPABASE_TEST_URL" in
  https://*.supabase.co) ;;
  *) printf '%s\n' "SUPABASE_TEST_URL must use https://<project>.supabase.co" >&2; exit 1 ;;
esac

status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  -X POST "$SUPABASE_TEST_URL/functions/v1/recipe-import" \
  -H "apikey: $SUPABASE_TEST_ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"importId":"integration-smoke"}')

if [ "$status" != "401" ]; then
  printf '%s\n' "Expected unauthenticated recipe-import request to return 401, got $status" >&2
  exit 1
fi

printf '%s\n' "Supabase integration smoke passed: recipe-import rejects unauthenticated access."

worker_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  -X POST "$SUPABASE_TEST_URL/functions/v1/recipe-import-worker" \
  -H "apikey: $SUPABASE_TEST_ANON_KEY" \
  -H 'Content-Type: application/json' \
  --data '{}')

if [ "$worker_status" != "401" ]; then
  printf '%s\n' "Expected unauthenticated recipe-import-worker request to return 401, got $worker_status" >&2
  exit 1
fi

printf '%s\n' "Supabase integration smoke passed: recipe-import-worker rejects unauthenticated access."
