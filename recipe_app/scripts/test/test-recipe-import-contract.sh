#!/usr/bin/env sh
# Static contract checks for recipe-import security invariants.

set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
function_file="$root/supabase/functions/recipe-import/index.ts"
worker_file="$root/supabase/functions/recipe-import-worker/index.ts"
base_migration="$root/supabase/migrations/20261120000000_recipe_imports.sql"
queue_migration="$root/supabase/migrations/20261120000100_recipe_import_queue_and_cleanup.sql"
hardening_migration="$root/supabase/migrations/20261120000200_recipe_import_cleanup_hardening.sql"
latest_migration="$root/supabase/migrations/20261120000500_recipe_import_lifecycle_safety.sql"
audit_migration="$root/supabase/migrations/20261120000600_recipe_import_maintenance_audit.sql"

fail() { printf 'RECIPE IMPORT CONTRACT FAIL: %s\n' "$*" >&2; exit 1; }

grep -Fq 'if (!authHeader) return json(request, { error: "not_authenticated" }, 401);' "$function_file" \
  || fail "authenticated boundary is missing"
grep -Fq 'await reapExpiredSources();' "$function_file" \
  || fail "protected cleanup call is missing"
if grep -Fq 'runInline' "$function_file" "$worker_file"; then
  fail "client-controlled runInline bypass remains"
fi
grep -Fq 'anyOf: [{ type: "number" }, { type: "null" }]' "$function_file" \
  || fail "provider schema does not allow nullable quantities"
grep -Fq 'status: "queued"' "$function_file" \
  || fail "retry state is missing"
grep -Fq 'source_cleanup_pending' "$function_file" \
  || fail "cleanup-pending state is missing"
grep -Fq "status <> 'processing'" "$hardening_migration" \
  || fail "processing imports are deletable"
grep -Fq 'recipe_imports_expired_source_idx' "$hardening_migration" \
  || fail "expiration index is missing"
grep -Fq 'recipe-import-worker' "$hardening_migration" \
  || fail "worker schedule is missing"
if grep -Fq 'delete from storage.objects' "$hardening_migration"; then
  fail "hardening migration directly deletes Storage metadata"
fi
grep -Fq "bucket_id = 'recipe-imports'" "$base_migration" \
  || fail "private import bucket policy is missing"
grep -Fq 'pgmq.create' "$queue_migration" \
  || fail "durable queue creation is missing"
grep -Fq "to_regnamespace('net')" "$latest_migration" \
  || fail "queue enqueue guard is missing from the final migration"
if grep -Eiq 'delete[[:space:]]+from[[:space:]]+storage\.objects' "$hardening_migration" "$latest_migration"; then
  fail "effective cleanup migrations directly delete Storage metadata"
fi
grep -Fq 'recipe_import_maintenance_runs' "$audit_migration" \
  || fail "cleanup maintenance audit state is missing"
grep -Fq 'reconcile_recipe_import_maintenance_runs' "$audit_migration" \
  || fail "cleanup maintenance reconciliation is missing"
expected_order=$(printf '%s\n' \
  "$(basename "$base_migration")" \
  "$(basename "$queue_migration")" \
  "$(basename "$hardening_migration")" \
  "$(basename "$latest_migration")" \
  "$(basename "$audit_migration")")
actual_order=$(printf '%s\n' "$expected_order" | sort)
[ "$expected_order" = "$actual_order" ] || fail "recipe-import migrations are not ordered"

printf '%s\n' "Recipe import contract checks passed."
