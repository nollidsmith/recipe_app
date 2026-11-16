# PantryPilot Architecture

**Status:** Forward-looking Section 0 draft

## Purpose

PantryPilot is a browser-based recipe and pantry application. Users authenticate, manage their own recipes, track pantry inventory, and build shopping lists from missing or low-stock ingredients.

## System shape

```text
Browser (React/Vite)
  ├── Supabase Auth (email/password, Google, Apple)
  ├── Supabase PostgreSQL (user-owned data + row-level security)
  └── Supabase Storage (user recipe images)

GitHub → GitHub Actions → Vite build → Hostinger shared hosting
```

The browser is the deployed application. There is no custom Node.js server in the shared-hosting deployment model. Supabase is the backend boundary and the database is the source of truth.

## Security boundaries

- Supabase Auth establishes the user identity.
- Every user-owned database row carries an ownership key and is protected by row-level security.
- The browser may use only the Supabase project URL and publishable/anonymous key. Service-role keys must never be bundled into Vite output.
- Image uploads are restricted by authenticated user, file type, size, and storage path.
- Mutations validate input in the client for usability and at the database/API boundary for truth.

## Frontend structure

- `src/app/` — route-level screens and route guards
- `src/components/` — reusable UI components
- `src/lib/` — Supabase client, auth helpers, validation, and domain utilities
- `src/styles/` — design tokens, responsive styles, and reduced-motion rules
- `src/types/` — shared TypeScript models and Supabase-generated types
- `public/images/` — non-user static assets only; user uploads live in Supabase Storage

The app uses client-side routing with an explicit Hostinger SPA fallback. Data access is colocated in feature modules rather than scattered through presentational components.

## Authentication and OAuth

Supabase Auth is the identity source. OAuth uses the client library’s PKCE/session handling. Redirect origins for local, preview, and production are:

- `http://localhost:5173` — local development
- Preview URL — UNKNOWN — needs human confirmation
- Production Hostinger domain — `https://recipe.dillonlsmith.com`

OAuth cancellation, provider failure, expired sessions, account linking, email verification, and password-reset behavior must have documented UI states before Section 1 implementation.

## Image storage

User images are stored as files in a private Supabase Storage bucket, with only the object path and descriptive metadata referenced by the recipe record. Bucket name, MIME allowlist, maximum size/dimensions, quota, signed-URL lifetime, EXIF handling, and orphan cleanup are UNKNOWN — needs human confirmation. Service-role access is prohibited in the browser.

## Known unknowns

- Exact Hostinger plan name: UNKNOWN — needs human confirmation.
- Supabase project URL and production project identity: UNKNOWN — created during setup.
- Final image size and MIME allowlist: UNKNOWN — set before upload implementation.

