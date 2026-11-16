# PantryPilot UX Baseline

**Status:** Forward-looking Section 0 draft

## Primary user

Home cooks who want one place to remember recipes, understand what is in the pantry, and reduce forgotten or duplicate grocery purchases.

## Core journeys

1. Sign up or sign in with email, Google, or Apple.
2. Land on the recipe hub and see saved recipes or a helpful empty state.
3. Add a recipe with ingredients, instructions, timing, servings, and an optional image.
4. Review a recipe and add missing ingredients to the shopping list.
5. Add pantry items and see low-stock/expiring states.
6. Review suggestions and mark shopping items complete.

## Authentication states

Support validation, loading, success, provider cancellation, provider failure, expired session, email verification, and password-reset states. Every error explains the next action.

## Image-upload journey

Users select an image, see a preview, receive progress feedback, and can cancel or retry. Unsupported type, size failure, network failure, replacement, removal, and abandoned upload states must be explicit. The user may provide alt text; otherwise the UI uses a descriptive fallback based on the recipe title.

## Required states

Every screen must define loading, empty, success, and actionable error states. Destructive actions require confirmation. Every interactive icon needs an accessible label.

## Visual direction

- Red: primary actions, warnings, and active emphasis
- Black/deep charcoal: navigation, headings, and structure
- Blue: information, secondary actions, and supporting highlights
- Recipe imagery uses a readable overlay and never carries meaning by color alone.

## Accessibility

Target WCAG 2.2 AA. Support keyboard navigation, visible focus, sufficient contrast, responsive touch targets, semantic headings, screen-reader labels, and reduced motion.

