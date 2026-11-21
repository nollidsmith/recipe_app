# Recipe import rollback

The recipe-import migrations are additive and should be rolled back by disabling
the feature first:

1. Set `RECIPE_IMPORT_QUEUE_ENABLED=false` in the target Supabase project.
2. Stop deploying `recipe-import` and `recipe-import-worker`.
3. Preserve `recipe_imports` rows and the private `recipe-imports` bucket until
   temporary sources have been cleaned through the Storage API.
4. If the queue was enabled, unschedule `recipe-import-worker` and
   `recipe-import-source-cleanup` from `cron.job`.
5. Revert migrations only through a reviewed SQL change; do not delete
   `storage.objects` rows directly because that can orphan physical files.

The current free Development configuration keeps queue mode disabled and uses
the authenticated inline/background path. This is the safe fallback when Vault
or `pg_net` is unavailable.
