# PantryPilot Deployment

**Status:** Forward-looking Section 0 draft

## Environments

- Development: local Vite server connected to a development Supabase project
- Preview: GitHub branch build or manual Hostinger preview; exact preview method UNKNOWN
- Production: Vite build uploaded to Hostinger shared hosting and served from the PantryPilot domain

## Release flow

1. Open a feature branch.
2. Run local checks.
3. Open a GitHub pull request.
4. GitHub Actions runs the required checks.
5. Merge after review.
6. Build the static output.
7. Upload the output to Hostinger’s domain `public_html` directory.

## Static build contract

- Build command: UNKNOWN until the Vite scaffold is created.
- Output directory: `dist/`.
- Client-side routes require an SPA fallback to `index.html`; Hostinger rewrite configuration is UNKNOWN — needs human confirmation.
- HTTPS is required for production OAuth and authenticated traffic.
- Cache invalidation/versioning strategy: UNKNOWN — needs human confirmation.

## GitHub Actions deployment

CI must at minimum build and archive `dist/`. Automatic upload to Hostinger is optional until the preferred Hostinger deployment mechanism and secret storage are confirmed. Any deployment credential must be stored as a GitHub secret and never committed.

## Secrets

Local secrets live in an ignored `.env.local`. GitHub and production secrets must be configured in their respective secret stores. Never commit real Supabase keys or OAuth secrets.

## Rollback

Keep the previous static build archive until the new build is verified. Rollback means restoring the previous known-good static files and, for database changes, applying a reviewed migration strategy.

## Hostinger constraint

The MVP is static because shared hosting does not provide the Node.js runtime required by a normal Next.js server deployment. A Hostinger VPS would be required if a server-rendered Node.js application is introduced.

