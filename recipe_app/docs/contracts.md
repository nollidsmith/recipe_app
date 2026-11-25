# PantryPilot Contracts Inventory

**Status:** Section 1 recipe import, reconciled to source on 2026-11-20

This is the exhaustive inventory for the current static application baseline. Current contracts and explicitly labeled planned operations are listed together; any new route, environment variable, integration, storage path, database object, or public data shape must be added here in the same change that introduces it.

## Client routes

| Route | Purpose | Auth |
|---|---|---|
| `/login` | Sign in, sign up, OAuth, password reset | Public |
| `/reset-password` | Complete password reset | Public |
| `/` | Authenticated recipe hub | Required |
| `/recipes/new` | Create a recipe | Required |
| `/pantry` | Manage pantry inventory | Required |
| `/shopping` | Placeholder coming-soon shopping-list screen | Required |
| `/popular` | Placeholder coming-soon popular-recipes screen | Required |
| `/profile` | Placeholder coming-soon profile/settings screen | Required |

`/recipes/new` is create-only. There is no recipe detail/edit route. Shopping-list,
favorites, recipe editing, and full profile/settings behavior are planned, not current.

## Environment variables

- `VITE_SUPABASE_URL` — required client Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — required publishable Supabase key
No service-role, database-password, or OAuth client secret may be a Vite client variable.
- `GEMINI_API_KEY` — Supabase Edge Function secret for Google Gemini extraction; never a Vite variable
- `RECIPE_IMPORT_ALLOWED_ORIGINS` — optional comma-separated Edge Function CORS allowlist
- `RECIPE_IMPORT_QUEUE_ENABLED` — set to `true` only after the pgmq migration and worker are configured; otherwise the Edge Function uses its inline fallback
- `RECIPE_IMPORT_QUEUE_READY` — private deployment readiness assertion required alongside queue enablement; user requests still fall back to inline claiming if runtime readiness drifts
- `RECIPE_IMPORT_WORKER_TOKEN` — private shared secret for the queue worker to invoke `recipe-import`; never a Vite variable

## Auth integration

- Email/password sign-up and sign-in
- Google OAuth
- Password-reset request and callback
- Session refresh and logout
- OAuth redirect allowlist: `http://localhost:5173` and `https://recipe.dillonlsmith.com`; no preview deployment is configured.
- Account linking behavior: disabled in the current Supabase production configuration; no user-facing linking flow is exposed.
- Signup profile data: the UI sends first name as Supabase `user_metadata.first_name`; the `handle_new_user_profile` trigger persists it to `profiles.display_name`.

## Storage contract

- Provider: Supabase Storage
- Buckets: private `recipe-images`, `pantry-images`, and temporary `recipe-imports`
- Path convention: `{user_id}/recipes/{recipe_id}/{uuid}.{ext}` or `{user_id}/pantry/{pantry_item_id}/{uuid}.{ext}`; the Storage policy sees three folder segments because the filename is excluded by `storage.foldername()`.
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Maximum file size: 5 MB. Image dimensions are not currently validated.
- Private images use signed URLs when displayed.
- Recipe import sources use exactly `{user_id}/{import_id}/source/{source_filename}`, accept PDF/JPEG/PNG/WebP, and are limited to 10 MB. Cleanup is attempted on terminal paths and by `cleanup_expired_recipe_import_sources()` when pg_cron is available; `expires_at` records a one-hour cleanup deadline.
- Service-role key is never exposed to the browser or static build.
- Recipe replacement/deletion attempts to remove the previous object; failed uploads are cleaned up where implemented. Pantry images are created with an item and removed on item deletion; pantry-image replacement is not implemented. Orphan cleanup remains deferred.

## Integrations

- Supabase Auth: email/password and Google OAuth
- Supabase PostgreSQL: application data
- Supabase Storage: authenticated recipe and pantry item image files
- GitHub Actions: CI checks and protected production deployment
- Hostinger shared hosting: static production files
- Custom API server: none planned
- Supabase Edge Function: authenticated `recipe-import` validates and normalizes provider output into an editable draft; it never creates a recipe row.
- Supabase Edge Function: `recipe-import-worker` accepts only `RECIPE_IMPORT_WORKER_TOKEN`, reads the internal pgmq queue using service-role-backed RPCs, and invokes `recipe-import` with the same token; the service-role key is never sent to the browser or provider.
- Google Gemini: called only by the Edge Function using `GEMINI_API_KEY`; response schema is `pantrypilot_recipe_draft_v1`.
- Webhooks: none planned

## Database boundary

The application depends on `profiles`, `recipes`, `recipe_ingredients`, `pantry_items`, `shopping_list_items`, `favorites`, and `recipe_imports`, as described in `data-model.md`. All user-owned objects require ownership enforcement.

## Build and deployment contracts

- Vite source variables use the `VITE_` prefix.
- Production build command is `npm run build` from `recipe_app/` or `npm --prefix recipe_app run build` from the workspace root; output is `recipe_app/dist/`.
- Hostinger must serve `index.html` for client-side routes; the deployed `public_html/.htaccess` provides the SPA rewrite fallback.
- Root `.github/workflows/recipe-app-checks.yml` runs procedure checks and the `typecheck, test, and build` job. A push to `main` additionally requires the configured production bundle, Supabase preflight, and integration checks before the protected `deploy-production` job runs.
- The `deploy-production` job builds `dist/` with production variables, verifies the bundle, creates a compressed backup outside the Hostinger web root, synchronizes the static bundle to the configured `public_html` path over SSH, and runs both `scripts/verify-production-site.sh` and the Playwright browser smoke suite against `https://recipe.dillonlsmith.com/`. A failed synchronization or health check restores the backup and reruns both smoke checks. It uses the protected GitHub `production` environment and a concurrency lock.
- Hostinger deployment secrets are not stored in the repository. The protected `production` environment supplies the Supabase production variables plus `HOSTINGER_SSH_HOST`, `HOSTINGER_SSH_PORT`, `HOSTINGER_SSH_USER`, `HOSTINGER_SSH_PRIVATE_KEY`, `HOSTINGER_KNOWN_HOSTS`, and `HOSTINGER_DEPLOY_PATH`.

## Recipe import contract

- Request: `POST recipe-import` with `{ importId: string }` and the authenticated Supabase bearer token.
- Queue mode: when `RECIPE_IMPORT_QUEUE_ENABLED=true`, the authenticated request acknowledges a queued job and `recipe-import-worker` performs the processing. The worker can run inline for one claimed job and leaves queue messages visible after network/5xx failures for pgmq retry.
- Job statuses: `queued → processing → ready|needs_review|failed`. The browser polls the owner-scoped row; only the Edge Function changes processing fields.
- PDF guard: PDFs must begin with `%PDF-` and expose between 1 and 20 visible `/Type /Page` markers. Compressed/encoded page trees fail closed because no PDF dependency is bundled; this is a conservative guard, not a complete parser.
- Draft shape: `title`, `description`, `instructions`, `prepMinutes`, `cookMinutes`, and `servings` are strings; `difficulty` is `easy|medium|hard`; `ingredients` is an array of `{ name: string, quantity: number|null, unit: string|null, notes: string|null }`.
- Review metadata: `warnings_json` is an array of strings; `confidence_json` is an object whose values are numbers from 0 to 1.
- Success returns `{ status: "ready"|"needs_review" }`. Known failure codes include `not_authenticated`, `invalid_import_id`, `import_not_found`, `invalid_source`, `invalid_source_path`, `provider_not_configured`, `provider_failed`, `invalid_provider_result`, and `source_cleanup_failed`.
- The import never inserts into `recipes`; only the existing explicit Save recipe action persists a reviewed draft.

## Contract change rule

Any change to this inventory requires a documented compatibility assessment, relevant tests, and updates to the related data-model, API, UX, or deployment documentation in the same change.

<!-- update-this-doc-when: src/App.tsx, src/lib/*.ts, src/types/*.ts, .env.example, supabase/migrations/*.sql, supabase/functions/**/*.ts, .github/workflows/recipe-app-checks.yml -->

