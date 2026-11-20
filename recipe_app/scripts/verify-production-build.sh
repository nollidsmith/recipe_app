#!/usr/bin/env sh
# Build and verify the browser bundle with production Supabase configuration.

set -eu

: "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL must be set for a production build}"
: "${VITE_SUPABASE_ANON_KEY:?VITE_SUPABASE_ANON_KEY must be set for a production build}"

case "$VITE_SUPABASE_URL" in
  https://*.supabase.co) ;;
  *) printf '%s\n' "Production Supabase URL must use https://<project>.supabase.co" >&2; exit 1 ;;
esac

npm run build

test -f dist/index.html || { printf '%s\n' "Production build did not create dist/index.html" >&2; exit 1; }
test -f dist/.htaccess || { printf '%s\n' "Production build is missing the SPA fallback .htaccess" >&2; exit 1; }

if ! grep -R -F -q -- "$VITE_SUPABASE_URL" dist/assets; then
  printf '%s\n' "Production Supabase URL was not embedded in the generated assets" >&2
  exit 1
fi

printf '%s\n' "Production bundle verified: index, SPA fallback, and Supabase project URL are present."
