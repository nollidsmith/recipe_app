#!/usr/bin/env sh
# Verify the generic Vite artifact produced by CI is deployable and client-safe.

set -eu

test -f dist/index.html || { printf '%s\n' "Build artifact is missing dist/index.html" >&2; exit 1; }
test -f dist/.htaccess || { printf '%s\n' "Build artifact is missing dist/.htaccess" >&2; exit 1; }
test -d dist/assets || { printf '%s\n' "Build artifact is missing dist/assets" >&2; exit 1; }
test "$(find dist/assets -type f | wc -l | tr -d ' ')" -gt 0 || { printf '%s\n' "Build artifact contains no assets" >&2; exit 1; }

if grep -R -E -q -- 'SUPABASE_SERVICE_ROLE_KEY|GEMINI_API_KEY|BEGIN PRIVATE KEY' dist; then
  printf '%s\n' "Build artifact contains a server-side credential marker" >&2
  exit 1
fi

printf '%s\n' "Build artifact verified: SPA entrypoint, fallback, assets, and client-safe credentials."
