# PantryPilot Testing Strategy

**Status:** Section 1 recipe import, reconciled to current suite on 2026-11-20

## Current coverage

The current suite has 14 Vitest/jsdom files and 45 tests covering login flows,
password reset, recipe form validation/submission/import review, recipe data
access and image MIME validation, and pantry image MIME validation with
pre-insert rejection. Edge Function, RLS, and Storage isolation tests are not
yet configured.

Recipe-import polling is covered for queued, processing, ready, failed, and
timeout outcomes in `src/test/recipeImport.polling.test.ts`. Component tests also
exercise accessible names and the review-before-save boundary. The broader
journey lists below are planned coverage, not completed coverage.

## Required levels

- Unit tests for ingredient normalization, stock thresholds, suggestion logic, and form validation.
- Component tests for login, recipe forms, pantry rows, shopping-list actions, loading states, and error states.
- Integration tests for Supabase data access with isolated test users and data.
- End-to-end tests for sign-in, recipe creation, pantry updates, and adding missing ingredients to the shopping list.

## Journey/state coverage

- Login: success, invalid credentials, OAuth success, OAuth cancellation/failure, password reset, expired session.
- Recipe hub: first-use empty state, populated state, loading, and network error.
- Recipe editor: validation errors, image preview/progress/retry, save success, replacement, removal, and delete confirmation.
- Pantry: add/edit/delete, low-stock and expiration states, empty state, and failed mutation.
- Shopping list: derived suggestions, duplicate prevention, completion, and failed update.
- Accessibility: recipe-editor accessible-name and keyboard-tab-order smoke checks
  are automated in `src/test/accessibility.test.tsx`; full axe, contrast, and
  screen-reader automation remains planned.

## Security tests

- A user cannot read another user’s recipes, pantry items, shopping items, favorites, or image files.
- Unauthenticated users cannot access protected routes or mutations.
- Invalid uploads are rejected by type and size policy.
- Service-role credentials never appear in the client bundle.
- Recipe imports never call `createRecipe` until the user explicitly saves the reviewed draft.
- Import provider output is normalized or rejected; malformed output cannot reach the recipe form as a saved record.
- Import source paths are owner-scoped and temporary Storage access is private.

## CI checks

The PR procedure gate is invoked as:

```sh
CI_PROJECT_PREFIX=recipe_app \
CI_PLACEHOLDER_ALLOW=recipe_app/.placeholder-allow \
sh recipe_app/scripts/ci-pr-checks.sh <target-sha> <head-sha>
```

The root workflow runs procedure checks plus `npm ci`, `npm run typecheck`,
`npm test`, `npm run build`, build-artifact checks, and a conditional Supabase
integration smoke job from `recipe_app/`. The live job is skipped explicitly
until `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY` are configured. There are no
configured coverage thresholds/reports, formatting or lint checks, full axe accessibility automation, RLS/Storage
security tests, oversized-image tests, or image-dimension tests. The build passes
with a non-failing approximately 503.10 kB main-bundle warning.

## Browser smoke tests

`npm run test:browser` runs Playwright against the production preview. It uses
placeholder Supabase browser configuration and mocks only the unauthenticated
session response, so it does not require production credentials. The suite
checks app boot, login and password-reset routing, protected-route lazy chunks,
unauthenticated redirects, browser errors, and failed asset requests. The same
suite runs against the deployed production URL after synchronization and again
after rollback. Authenticated flows remain manual until a dedicated non-
production test environment and disposable test account exist.

<!-- update-this-doc-when: package.json, src/test/**, browser-tests/**, playwright.config.ts, scripts/**, supabase/tests/**, .github/workflows/recipe-app-checks.yml -->

