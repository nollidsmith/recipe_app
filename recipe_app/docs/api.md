# PantryPilot Data Access and API Contract

**Status:** Forward-looking Section 0 draft

PantryPilot has no custom HTTP API in the shared-hosting MVP. The browser calls Supabase Auth, PostgREST/database operations, and Storage through a dedicated client module. There are no custom routes, RPCs, Edge Functions, webhooks, or external API integrations in the initial release: none planned.

## Auth operations

- Sign up with email/password
- Sign in with email/password
- Start Google OAuth
- Start Apple OAuth
- Request password reset
- Sign out
- Read the current session

OAuth configuration must include local, preview, and production redirect URLs. Exact preview and production URLs are UNKNOWN — needs human confirmation.

## Data operations

- List, create, read, update, and delete the current user’s recipes
- List, create, update, and delete ingredients belonging to the current user’s recipes
- List, create, update, and delete the current user’s pantry items
- List, create, complete, and delete the current user’s shopping-list items
- Add/remove favorites for the current user’s recipes
- Upload, replace, and delete the current user’s recipe images

Storage operations require an authenticated session, an owner-scoped path, MIME/extension validation, a maximum size limit, safe filenames, and cleanup of replaced or abandoned objects. Exact limits and bucket name are UNKNOWN — needs human confirmation.

## Validation

- Client validation provides immediate feedback.
- Database constraints and row-level security are authoritative.
- Errors must be mapped to actionable user messages without exposing credentials or internal database details.

## Future boundary

If server-side logic becomes necessary, it must be introduced as a documented service boundary rather than hidden inside UI components.

