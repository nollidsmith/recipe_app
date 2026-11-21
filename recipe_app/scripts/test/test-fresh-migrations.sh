#!/usr/bin/env sh
# Apply the complete migration chain to an isolated disposable database and
# verify the final recipe-import objects. This is opt-in because reset is
# destructive to the database URL supplied for the test.

set -eu

if [ -z "${SUPABASE_MIGRATION_TEST_DB_URL:-}" ]; then
  printf '%s\n' "SKIP: SUPABASE_MIGRATION_TEST_DB_URL is not configured."
  exit 0
fi

[ "${SUPABASE_MIGRATION_TEST_CONFIRM:-}" = "RECIPE_IMPORT_FRESH_TEST" ] \
  || { printf '%s\n' "FRESH MIGRATION TEST FAIL: set SUPABASE_MIGRATION_TEST_CONFIRM=RECIPE_IMPORT_FRESH_TEST for a disposable database." >&2; exit 1; }

command -v supabase >/dev/null 2>&1 \
  || { printf '%s\n' "FRESH MIGRATION TEST FAIL: Supabase CLI is required." >&2; exit 1; }

supabase db reset --db-url "$SUPABASE_MIGRATION_TEST_DB_URL" --yes
result=$(supabase db query --db-url "$SUPABASE_MIGRATION_TEST_DB_URL" --read-only --output-format json \
  "select json_build_object('table', to_regclass('public.recipe_imports') is not null, 'bucket', exists (select 1 from storage.buckets where id = 'recipe-imports' and public = false), 'queue', to_regclass('pgmq.q_recipe_imports') is not null, 'cleanup_audit', to_regclass('public.recipe_import_maintenance_runs') is not null, 'cleanup_policy', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recipe_imports' and policyname = 'Users can delete cleaned recipe imports')) as checks;")

printf '%s' "$result" | grep -Fq '"table":true' || { printf '%s\n' "FRESH MIGRATION TEST FAIL: recipe_imports table missing." >&2; exit 1; }
printf '%s' "$result" | grep -Fq '"bucket":true' || { printf '%s\n' "FRESH MIGRATION TEST FAIL: private recipe-imports bucket missing." >&2; exit 1; }
printf '%s' "$result" | grep -Fq '"queue":true' || { printf '%s\n' "FRESH MIGRATION TEST FAIL: pgmq queue missing." >&2; exit 1; }
printf '%s' "$result" | grep -Fq '"cleanup_audit":true' || { printf '%s\n' "FRESH MIGRATION TEST FAIL: cleanup audit table missing." >&2; exit 1; }
printf '%s' "$result" | grep -Fq '"cleanup_policy":true' || { printf '%s\n' "FRESH MIGRATION TEST FAIL: final cleanup delete policy missing." >&2; exit 1; }
printf '%s\n' "Fresh recipe-import migration test passed."
