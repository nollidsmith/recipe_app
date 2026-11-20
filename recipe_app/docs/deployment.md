# PantryPilot Deployment

**Status:** Section 0 baseline, reconciled to workflow on 2026-11-19

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
6. Build the static output with production variables using `npm run build:production`.
7. Upload `recipe_app/dist/` through the Hostinger mechanism to the domain document root. The static bundle includes `.htaccess` for SPA fallback; live route verification remains required.

## Static build contract

- Build command: `npm run build` from `recipe_app/`, or `npm --prefix recipe_app run build` from the workspace root.
- Production build command: `npm run build:production`; it fails closed unless `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set and verifies the production URL is embedded in the generated assets.
- Output directory: `recipe_app/dist/`.
- Client-side routes require an SPA fallback to `index.html`; Hostinger rewrite configuration is UNKNOWN — needs human confirmation.
- HTTPS is required for production OAuth and authenticated traffic.
- Cache invalidation/versioning strategy: UNKNOWN — needs human confirmation.

## GitHub Actions deployment

`.github/workflows/recipe-app-checks.yml` runs on pull requests and pushes to `main`/`master`. It runs `procedure checks` and `typecheck, test, and build` (`npm ci`, `npm run typecheck`, `npm test`, `npm run build` from `recipe_app/`). Pushes to `main` additionally run the configured production bundle check in the protected GitHub `production` environment. The workflow does not archive or upload `dist/`; Hostinger deployment remains a separate release step.

## Secrets

Local secrets live in an ignored `.env.local`. Configure `SUPABASE_PRODUCTION_URL` and `SUPABASE_PRODUCTION_ANON_KEY` as secrets in GitHub's protected `production` environment. Hostinger must receive the same production URL and publishable/anonymous key through its environment/build configuration. Never commit real Supabase keys or OAuth secrets.

## Rollback

Rollback procedure and verification are UNKNOWN — needs human confirmation.

## Hostinger constraint

The MVP targets static assets for shared hosting. Whether the selected Hostinger plan provides a Node.js runtime is UNKNOWN — needs human confirmation; a VPS or another Node-capable host would be required if a server-rendered Node.js application is introduced.

<!-- update-this-doc-when: package.json, vite.config.*, .github/workflows/recipe-app-checks.yml, deployment configuration, hosting runbooks -->

