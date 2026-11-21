# PantryPilot Data Access and API Contract

**Status:** Section 1 recipe import, reconciled to source on 2026-11-20

PantryPilot is a static browser app. It calls Supabase Auth, PostgREST/database operations, Storage, and the authenticated `recipe-import` Edge Function through dedicated client modules. The Edge Function is the only server-side boundary for the external recipe extraction provider.

## Auth operations

- Sign up with email/password
- Sign in with email/password
- Start Google OAuth
- Request password reset
- Sign out
- Read the current session

OAuth configuration includes the local and production redirect URLs; no preview deployment is configured.

## Data operations

- Current source implements listing/creating/deleting recipes, creating/deleting pantry items plus quantity updates, and recipe/pantry image reads/uploads/deletes where the UI exposes them.
- Shopping-list, favorites, recipe editing/detail, and full ingredient CRUD are planned data operations, not current UI contracts.

Storage operations require an authenticated session, an exact owner-scoped path, MIME validation, and a 5 MB maximum for images. Buckets are private `recipe-images`, `pantry-images`, and temporary `recipe-imports`; signed URLs are used for display. Live migration application and cross-user isolation remain UNKNOWN until verified against Supabase.

## Recipe import operation

- The browser inserts one `queued` `recipe_imports` row with a canonical owner-scoped source path, uploads the source to private Storage, and invokes `recipe-import` with `{ importId }`.
- The Edge Function authenticates the bearer token, validates the exact source path and limits, and either acknowledges queue mode or claims one queued job. Queue mode uses pgmq plus `recipe-import-worker`; the worker invokes the function with a private `RECIPE_IMPORT_WORKER_TOKEN` and retries messages that fail through a network/5xx response. Until the migration, queue, worker deployment, and secret are verified together, inline processing remains the safe fallback. The function normalizes `pantrypilot_recipe_draft_v1`, applies the conservative PDF guard, stores warnings/confidence, and attempts to delete the temporary source.
- The browser reads the owner-scoped job until `ready`, `needs_review`, or `failed`; only the existing explicit `createRecipe` save action writes a recipe.
- Provider credentials are Edge Function secrets. Provider failure, malformed output, and timeout fail closed with an actionable error.

The storage hardening migration does not prove that the hosted Supabase project has received the policy changes.

## Validation

- Client validation provides immediate feedback.
- Database constraints and row-level security are authoritative.
- Errors must be mapped to actionable user messages without exposing credentials or internal database details.

## Server boundary

The `recipe-import` Edge Function is the documented server-side boundary for provider credentials and recipe extraction. It must remain separate from the static browser bundle.

<!-- update-this-doc-when: src/lib/*.ts, src/app/*.tsx, src/types/*.ts, supabase/migrations/*.sql -->

