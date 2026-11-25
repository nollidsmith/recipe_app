# Session Notes

Use this file for concise handoff context between sessions.

## Current status

- T-018 is in progress: protected GitHub Actions deployment to Hostinger.

## Notes

- Keep this file free of secrets and sensitive personal information.
- Local uncommitted deployment workflow changes build and verify `dist/`, back up
  the current Hostinger release, and sync it over SSH after checks pass.
- Added Playwright browser smoke coverage for public boot, protected-route
  redirects, lazy route loading, and post-deploy/rollback verification; local
  browser tests pass.
- Next external step is configuring the GitHub `production` environment secrets;
  do not make that change or push until release confirmation is received.
