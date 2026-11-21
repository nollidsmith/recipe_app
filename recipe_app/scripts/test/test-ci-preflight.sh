#!/usr/bin/env sh
# Regression tests for CI secret gating and Supabase preflight behavior.

set -eu

root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
preflight="$root/scripts/supabase-preflight.sh"
workflow="$root/../.github/workflows/recipe-app-checks.yml"

run_expect_success() {
  if ! output=$(env -i PATH="$PATH" HOME="${HOME:-/tmp}" "$@" 2>&1); then
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

run_expect_failure() {
  if output=$(env -i PATH="$PATH" HOME="${HOME:-/tmp}" "$@" 2>&1); then
    printf 'Expected command to fail: %s\n%s\n' "$*" "$output" >&2
    exit 1
  fi
}

run_expect_success sh "$preflight"
run_expect_failure env SUPABASE_PREFLIGHT_URL=https://example.supabase.co sh "$preflight"
run_expect_failure env \
  SUPABASE_PREFLIGHT_URL=https://example.supabase.co \
  SUPABASE_PREFLIGHT_ANON_KEY=test \
  SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY=test \
  SUPABASE_PREFLIGHT_DB_URL=postgresql://test \
  SUPABASE_PREFLIGHT_ORIGIN=https://recipe.example \
  SUPABASE_PREFLIGHT_QUEUE_ENABLED=false \
  sh "$preflight"

if grep -q 'if:.*secrets\.' "$workflow"; then
  printf '%s\n' 'Workflow still contains an unsupported secret-based if condition.' >&2
  exit 1
fi

grep -q 'run-supabase-integration-tests.sh' "$workflow"
grep -q 'supabase-preflight.sh' "$workflow"
printf '%s\n' 'CI preflight regression checks passed.'
