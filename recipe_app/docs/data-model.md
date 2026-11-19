# PantryPilot Data Model

**Status:** Forward-looking Section 0 draft

## Ownership rule

Every application record belongs to the authenticated Supabase user through `user_id`. Row-level security must allow a user to read and mutate only their own records. The database, not client filtering, is the security boundary.

## Planned tables

### `profiles`

- `id` — UUID, references the auth user
- `display_name` — the user’s first name, captured during account creation
- `created_at`, `updated_at` — timestamps

PII: `display_name` is user-provided profile data. Authentication email remains owned by `auth.users` and is not duplicated as a password or credential.

### `recipes`

- `id` — UUID primary key
- `user_id` — UUID owner
- `title` — required text
- `description` — optional text
- `instructions` — required text or structured steps decision: UNKNOWN
- `prep_minutes`, `cook_minutes` — optional non-negative integers
- `servings` — optional positive integer
- `difficulty` — controlled value: easy, medium, hard
- `image_path` — optional Supabase Storage path
- `created_at`, `updated_at` — timestamps

Constraints: non-negative times, positive servings, owner-only access. Indexes: `(user_id, updated_at)` and `(user_id, title)`.

### `recipe_ingredients`

- `id` — UUID primary key
- `recipe_id` — recipe reference
- `name` — normalized display name
- `quantity` — optional numeric value
- `unit` — optional controlled text
- `notes` — optional text
- `position` — ordering integer

Constraints: foreign key to `recipes`, unique `(recipe_id, position)`, index on `recipe_id`.

### `pantry_items`

- `id` — UUID primary key
- `user_id` — UUID owner
- `name` — normalized display name
- `quantity` — numeric value
- `unit` — controlled text
- `category` — controlled or user-defined value: UNKNOWN
- `low_stock_threshold` — optional numeric value
- `expires_on` — optional date
- `created_at`, `updated_at` — timestamps

Constraints: non-negative quantity and threshold, index `(user_id, name)`, index `(user_id, expires_on)`.

### `shopping_list_items`

- `id` — UUID primary key
- `user_id` — UUID owner
- `name` — normalized display name
- `quantity` — optional numeric value
- `unit` — optional text
- `source_recipe_id` — optional recipe reference
- `is_completed` — boolean
- `created_at`, `updated_at` — timestamps

Constraints: index `(user_id, is_completed, created_at)`, optional foreign key to `recipes` owned by the same user.

### `favorites`

- `user_id` — UUID owner
- `recipe_id` — recipe reference
- composite primary key on user and recipe

## Image metadata

Recipe images are not stored as raw blobs in PostgreSQL. `recipes.image_path` references a private Storage object. If image metadata grows beyond the recipe row, a future `recipe_images` table may hold `id`, `recipe_id`, `user_id`, `storage_path`, `original_filename`, `mime_type`, `byte_size`, `width`, `height`, `alt_text`, and timestamps. That table is not part of the initial schema until upload requirements are finalized.

## RLS invariants

- Policies deny access by default.
- A user may select/insert/update/delete only rows whose `user_id` equals the authenticated Supabase user ID.
- Recipe ingredients are accessible only through recipes owned by the current user.
- Favorites are writable only for the current user and recipes visible to that user.
- Storage objects must use an owner-scoped path and matching Storage policies.

## Deletion and retention

Account deletion, cascade behavior, image cleanup, and retention duration are UNKNOWN — needs human confirmation. No destructive policy should be implemented until this is decided.

## Derived behavior

Shopping suggestions are derived from recipe ingredients plus pantry quantities and thresholds. They are not stored as a second source of truth.

## Migration rules

- All schema changes use versioned migrations.
- Migrations must be additive where practical and tested against an isolated database.
- Production changes must not be made manually through the dashboard.
- Delete behavior and retention policy: UNKNOWN — needs human confirmation.

