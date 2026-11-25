#!/usr/bin/env sh
# Verify the deployed static app shell, all referenced assets, and a real SPA route.

set -eu

base_url="${1:?usage: sh scripts/verify-production-site.sh <production-url>}"
case "$base_url" in
  http://*|https://*) ;;
  *) printf '%s\n' "Production URL must use http:// or https://" >&2; exit 1 ;;
esac
base_url="${base_url%/}"

check_site() {
  page=$(curl --fail --silent --show-error --location --retry 3 --retry-delay 2 --retry-all-errors --max-time 30 "$base_url/")
  printf '%s' "$page" | grep -Fq 'id="root"'

  asset_paths=$(printf '%s' "$page" | grep -oE '(src|href)="/assets/[^" ]+"' | sed -E 's/^[^\"]*\"//; s/\"$//')
  test -n "$asset_paths"
  while IFS= read -r asset_path; do
    test -n "$asset_path"
    curl --fail --silent --show-error --location --retry 3 --retry-delay 2 --retry-all-errors --max-time 30 "$base_url$asset_path" >/dev/null
  done <<EOF
$asset_paths
EOF

  route_page=$(curl --fail --silent --show-error --location --retry 3 --retry-delay 2 --retry-all-errors --max-time 30 "$base_url/recipes/new")
  printf '%s' "$route_page" | grep -Fq 'id="root"'
}

check_site
printf '%s\n' "Production site smoke check passed: app shell, assets, and /recipes/new SPA route are reachable."
