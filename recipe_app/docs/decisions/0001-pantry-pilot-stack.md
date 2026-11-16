# ADR 0001 — PantryPilot static-app foundation

**Status:** Proposed — pending unanimous documentation review

## Decision

PantryPilot will use React + TypeScript + Vite, Supabase Auth/PostgreSQL/Storage, GitHub Actions, and Hostinger shared hosting for the first release.

## Context

The app needs authenticated user-owned data, recipe images, and relational pantry/recipe behavior. The chosen Hostinger shared-hosting plan does not provide the Node.js runtime required by a normal Next.js server deployment, so the first release must build to static assets.

## Consequences

Positive: simple deployment, GitHub-friendly builds, managed authentication, PostgreSQL relationships, and no custom server to operate.

Trade-off: server-side application logic is limited. Authorization must be enforced through Supabase policies and database constraints. A future server-rendered or custom API architecture would require a Hostinger VPS or another Node-capable host.

User-uploaded images will use Supabase Storage rather than Hostinger file storage so ownership policies can be enforced alongside the database. Bucket visibility, limits, signed URL behavior, and cleanup remain UNKNOWN until the upload contract is finalized.

## Open follow-ups

- Confirm the exact Hostinger plan.
- Configure Google and Apple OAuth in Supabase.
- Define upload size/type limits and storage policies.
- Create development and production Supabase projects.

