# PantryPilot Deployment

**Status:** Section 1 recipe import, reconciled to workflow on 2026-11-20

## Environments

- Development: local Vite server using Supabase project `PantryPilot Development` (`hgdwkdenujvtjdveafmf`)
- Preview: exact preview method and hosting are UNKNOWN — needs human confirmation
- Production: Hostinger static hosting at `https://recipe.dillonlsmith.com`, using Supabase project `PantryPilot` (`canbplxrqkhtvycxtfag`, `https://canbplxrqkhtvycxtfag.supabase.co`)

## Release flow

1. Open a feature branch.
2. Run local checks.
3. Open a GitHub pull request.
4. GitHub Actions runs the required checks.
5. Merge after review.
6. GitHub Actions builds and verifies the static output with production variables using `npm run build:production`.
7. After the required checks and Supabase preflight pass, GitHub Actions backs up the current Hostinger release, syncs the generated `dist/` contents into `public_html` over SSH, and verifies the production URL. A failed sync or health check restores the previous archive.

## Static build contract

- Build command: `npm run build` from `recipe_app/`, or `npm --prefix recipe_app run build` from the workspace root.
- Production build command: `npm run build:production`; it fails closed unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set and verifies the production URL is embedded in the generated assets.
- Output directory: `recipe_app/dist/`.
- Client-side routes require an SPA fallback to `index.html`; Hostinger `public_html/.htaccess` provides the deployed SPA fallback.
- HTTPS is required for production OAuth and authenticated traffic.
- Cache invalidation/versioning strategy: UNKNOWN — needs human confirmation.

## GitHub Actions deployment

`.github/workflows/recipe-app-checks.yml` runs on pull requests and pushes to `main`/`master`. Pull requests run repository-local checks without live-project secrets. Pushes to `main` additionally build the configured production bundle, run the mandatory Supabase integration and preflight checks, back up the current Hostinger release outside the web root, sync `dist/` to Hostinger over SSH, and run `scripts/verify-production-site.sh` against the root page, every referenced asset, and the `/recipes/new` SPA route. The deployment job uses the protected GitHub `production` environment and a concurrency lock so only one production release runs at a time.

## Secrets

Local secrets live in an ignored `.env.local`. Configure `SUPABASE_PRODUCTION_URL` and `SUPABASE_PRODUCTION_ANON_KEY` as secrets in GitHub's protected `production` environment. Hostinger must receive the same production URL and publishable/anonymous key through its environment/build configuration. Never commit real Supabase keys or OAuth secrets.

The automatic Hostinger deployment additionally requires these `production`
environment secrets: `HOSTINGER_SSH_HOST`, `HOSTINGER_SSH_PORT`,
`HOSTINGER_SSH_USER`, `HOSTINGER_SSH_PRIVATE_KEY`, `HOSTINGER_KNOWN_HOSTS`, and
`HOSTINGER_DEPLOY_PATH` (the site's `public_html` path). The workflow creates a
compressed backup in the sibling `.deploy-backups/` directory outside the web
root before syncing the verified bundle. The production preflight also requires
`SUPABASE_PREFLIGHT_URL`, `SUPABASE_PREFLIGHT_ANON_KEY`,
`SUPABASE_PREFLIGHT_SERVICE_ROLE_KEY`, `SUPABASE_PREFLIGHT_DB_URL`,
`SUPABASE_PREFLIGHT_ORIGIN`, `SUPABASE_PREFLIGHT_QUEUE_ENABLED`, and
`SUPABASE_PREFLIGHT_WORKER_TOKEN`; `SUPABASE_PREFLIGHT_QUEUE_READY` is required
when queue mode is enabled. Push verification also requires
`SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY`, which are also scoped to the
protected `production` environment.

The deployment smoke check retries transient HTTP failures and verifies the
static app shell, every asset referenced by `index.html`, and the `/recipes/new`
SPA fallback route. It does not execute the browser application or authenticate;
browser-level boot, public reset-password rendering, protected-route lazy loading,
and unauthenticated redirects run in the CI app job and after production deploy
with Playwright. Authentication itself remains a manual post-release check.

## Recipe import deployment

Before enabling the import UI in an environment:

1. Apply the `recipe_imports` migration to that environment's Supabase project.
2. Deploy `supabase/functions/recipe-import`.
3. Apply the queue/cleanup migrations and confirm `pgmq` and `pg_cron` are enabled. If Vault or `pg_net` is unavailable, keep `RECIPE_IMPORT_QUEUE_ENABLED=false`; the safe inline/background path remains active.
4. Deploy `supabase/functions/recipe-import-worker`. Only enable queue mode after setting `RECIPE_IMPORT_QUEUE_ENABLED=true`, `RECIPE_IMPORT_QUEUE_READY=true`, `RECIPE_IMPORT_WORKER_TOKEN`, and (if needed) `RECIPE_IMPORT_ALLOWED_ORIGINS` as Edge Function secrets and confirming the worker schedule.
5. Verify the private `recipe-imports` bucket, owner policies, provider response schema `pantrypilot_recipe_draft_v1`, worker invocation, cleanup schedule, and a signed-in test import.

Cleanup uses the privileged Edge Function and Supabase Storage API through the worker path; it does not delete `storage.objects` rows directly. When the scheduler prerequisites are unavailable, queue enqueueing and scheduled cleanup remain disabled rather than silently accumulating jobs. If Vault-backed scheduling is enabled, use Vault names `project_url` and `recipe_import_worker_token`; never place a service key or token in a migration literal.

The repository preflight verifies CORS, unauthenticated boundaries, the private
`recipe-imports` bucket, and the `recipe_imports` REST table. A complete release
preflight also supplies a read-only database connection so the script can verify
the applied migration set, `pgmq`, `pg_cron`, Vault-backed worker secrets, queue
and cleanup schedules, and the final Storage policies. The preflight does not
print or expose secret values.

The repository does not contain the Gemini credential or a provider health-check implementation. Production import availability is UNKNOWN until these steps are completed.

## Rollback

The workflow retains the previous production archive outside `public_html` and automatically restores it when synchronization or the production health check fails, then checks that the restored site responds. After a successful release, the owner should still verify the login route, SPA navigation, and authentication flow. Manual rollback remains available by extracting the retained archive into `public_html` with overwrite enabled.

## Verified production release

- 2026-11-20 — deployed the merged `main` build to Hostinger `public_html` and verified the production app loads.
- 2026-11-20 — signed out and completed Google sign-in at `https://recipe.dillonlsmith.com`; the authenticated dashboard, account email, and main navigation loaded successfully.
- 2026-11-20 — rotated the Google OAuth client secret in Google Cloud, updated Supabase production, disabled and deleted the old secret, and retested sign-in successfully.

## Hostinger constraint

The MVP targets static assets for shared hosting. Whether the selected Hostinger plan provides a Node.js runtime is UNKNOWN — needs human confirmation; a VPS or another Node-capable host would be required if a server-rendered Node.js application is introduced.

<!-- update-this-doc-when: package.json, vite.config.*, .github/workflows/recipe-app-checks.yml, deployment configuration, hosting runbooks -->

