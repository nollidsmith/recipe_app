# PantryPilot Testing Strategy

**Status:** Forward-looking Section 0 draft

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
- Accessibility: keyboard navigation, focus order, labels, contrast, reduced-motion behavior, and 44px touch targets.

## Security tests

- A user cannot read another user’s recipes, pantry items, shopping items, favorites, or image files.
- Unauthenticated users cannot access protected routes or mutations.
- Invalid uploads are rejected by type and size policy.
- Service-role credentials never appear in the client bundle.

## CI checks

GitHub Actions must run formatting, linting, TypeScript checks, unit/component tests, integration tests, and a production build. Exact commands are UNKNOWN until the scaffold is installed.

