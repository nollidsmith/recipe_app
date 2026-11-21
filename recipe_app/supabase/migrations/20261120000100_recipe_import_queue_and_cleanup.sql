-- Free-path queue and cleanup infrastructure for T-009.
--
-- pgmq is required for this migration. If it is not available on an account,
-- do not apply this migration and leave RECIPE_IMPORT_QUEUE_ENABLED unset; the
-- existing inline Edge Function path remains the safe fallback. The queue
-- trigger is deliberately delayed so the browser can finish uploading the
-- source after inserting the job.
create extension if not exists pgmq;
select pgmq.create('recipe-imports');

CREATE OR REPLACE FUNCTION public.enqueue_recipe_import_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  -- The 30-second delay gives the authenticated browser time to upload the
  -- private source object before a worker can claim the message.
  PERFORM pgmq.send(
    'recipe-imports',
    jsonb_build_object('import_id', NEW.id),
    30
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_imports_enqueue_job ON public.recipe_imports;
CREATE TRIGGER recipe_imports_enqueue_job
AFTER INSERT ON public.recipe_imports
FOR EACH ROW EXECUTE FUNCTION public.enqueue_recipe_import_job();

CREATE OR REPLACE FUNCTION public.read_recipe_import_queue(
  p_visibility_timeout integer DEFAULT 120,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (message_id bigint, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT msg_id, message
  FROM pgmq.read('recipe-imports', greatest(30, least(p_visibility_timeout, 900)), greatest(1, least(p_limit, 10)));
$$;

CREATE OR REPLACE FUNCTION public.delete_recipe_import_queue_message(p_message_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT pgmq.delete('recipe-imports', p_message_id);
$$;

REVOKE ALL ON FUNCTION public.enqueue_recipe_import_job() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.read_recipe_import_queue(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_recipe_import_queue_message(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_recipe_import_queue(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_recipe_import_queue_message(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_expired_recipe_import_sources()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  cleaned integer;
BEGIN
  WITH deleted AS (
    DELETE FROM storage.objects object_row
    USING public.recipe_imports import_row
    WHERE object_row.bucket_id = 'recipe-imports'
      AND object_row.name = import_row.source_path
      AND import_row.source_path IS NOT NULL
      AND import_row.expires_at < timezone('utc', now())
    RETURNING object_row.name
  )
  UPDATE public.recipe_imports import_row
  SET source_path = NULL,
      error_code = COALESCE(import_row.error_code, 'source_expired'),
      error_message = COALESCE(import_row.error_message, 'Temporary source removed after its retention window.')
  FROM deleted
  WHERE import_row.source_path = deleted.name;

  GET DIAGNOSTICS cleaned = ROW_COUNT;

  RETURN cleaned;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_recipe_import_sources() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_recipe_import_sources() TO service_role;

-- Schedule direct database cleanup when pg_cron is available. This does not
-- require a network secret. If cleanup later moves to an Edge Function, use
-- Supabase Vault rather than putting a token in this migration:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<function-invocation-secret>', 'cleanup_token');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    EXECUTE 'create extension if not exists pg_cron';
    EXECUTE 'select cron.schedule($1, $2, $3)'
      USING 'recipe-import-source-cleanup', '15 * * * *', 'select public.cleanup_expired_recipe_import_sources();';
  ELSE
    RAISE NOTICE 'pg_cron is unavailable; run cleanup_expired_recipe_import_sources() from account scheduler';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron setup skipped safely: %', SQLERRM;
END
$$;
