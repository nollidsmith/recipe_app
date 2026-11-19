# PantryPilot Contracts Inventory

**Status:** Forward-looking Section 0 draft

This is the initial exhaustive inventory for the planned static MVP. Any new route, environment variable, integration, storage path, database object, or public data shape must be added here in the same change that introduces it.

## Client routes

| Route | Purpose | Auth |
|---|---|---|
| `/login` | Sign in, sign up, OAuth, password reset | Public |
| `/` | Authenticated recipe hub | Required |
| `/recipes/new` | Create a recipe | Required |
| `/recipes/:id` | View and edit a recipe | Required; owner only |
| `/pantry` | Manage pantry inventory | Required |
| `/shopping-list` | Manage shopping list and suggestions | Required |
| `/settings` | Account and preference settings | Required |

## Environment variables

- `VITE_SUPABASE_URL` — required client Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — required publishable Supabase key
- `VITE_APP_ENV` — development, preview, or production
- `VITE_APP_URL` — canonical app URL; production value `https://recipe.dillonlsmith.com`

No service-role, database-password, or OAuth client secret may be a Vite client variable.

## Auth integration

- Email/password sign-up and sign-in
- Google OAuth
- Apple OAuth
- Password-reset request and callback
- Session refresh and logout
- OAuth redirect allowlist: `http://localhost:5173`, preview URL UNKNOWN, and `https://recipe.dillonlsmith.com`
- Account linking behavior: UNKNOWN — needs human confirmation
- Signup profile data: first name is required for email account creation and stored in `profiles.display_name`.

## Storage contract

- Provider: Supabase Storage
- Bucket: `recipe-images`
- Visibility: private by default
- Planned path convention: `{user_id}/recipes/{recipe_id}/{image_id}`
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Maximum file size: 5 MB; maximum dimensions: 2048 × 2048 (client display guidance; server bucket limit enforces file size and MIME)
- Private images use signed URLs when displayed.
- Service-role key is never exposed to the browser or static build.
- Replacement and deletion remove the previous owner-scoped object; failed uploads clean up the newly created object. Abandoned-object lifecycle cleanup remains deferred.

## Integrations

- Supabase Auth: email/password, Google OAuth, Apple OAuth
- Supabase PostgreSQL: application data
- Supabase Storage: authenticated recipe image files
- GitHub Actions: CI checks
- Hostinger shared hosting: static production files
- Custom API server: none planned
- Supabase RPCs/Edge Functions: none planned
- Webhooks: none planned

## Database boundary

The application depends on `profiles`, `recipes`, `recipe_ingredients`, `pantry_items`, `shopping_list_items`, and `favorites`, as described in `data-model.md`. All user-owned objects require ownership enforcement.

## Build and deployment contracts

- Vite source variables use the `VITE_` prefix.
- Production build output is `dist/`.
- Hostinger must serve `index.html` for client-side routes; rewrite method is UNKNOWN — needs human confirmation.
- GitHub Actions must build the same `dist/` artifact used for production.
- Hostinger upload mechanism and deployment secret inventory are UNKNOWN — needs human confirmation.

## Contract change rule

Any change to this inventory requires a documented compatibility assessment, relevant tests, and updates to the related data-model, API, UX, or deployment documentation in the same change.

