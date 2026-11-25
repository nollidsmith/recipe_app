-- Corrective migration for T-009 queue and temporary-source lifecycle.
--
-- This migration supersedes the cleanup function from
-- 20261120000100_recipe_import_queue_and_cleanup.sql. It never deletes
-- storage.objects rows directly: expired sources are removed by the protected
-- recipe-import Edge Function, which uses the Supabase Storage API.

create index if not exists recipe_imports_expired_source_idx
on public.recipe_imports (expires_at)
where source_path is not null;

drop policy if exists "Users can delete their own recipe imports"
on public.recipe_imports;

create policy "Users can delete their own non-processing recipe imports"
on public.recipe_imports for delete to authenticated
using (auth.uid() = user_id and status <> 'processing');

create or replace function public.invoke_recipe_import_worker()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  worker_token text;
  request_id bigint;
begin
  -- Vault and pg_net are optional on Free-plan projects. The function is
  -- intentionally a no-op until both the extension and the two Vault secrets
  -- exist. Expected Vault names are project_url and
  -- recipe_import_worker_token.
  if to_regnamespace('vault') is null or to_regnamespace('net') is null then
    return null;
  end if;

  execute $query$
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1),
      (select decrypted_secret from vault.decrypted_secrets where name = 'recipe_import_worker_token' limit 1)
  $query$
  into project_url, worker_token;

  if nullif(project_url, '') is null or nullif(worker_token, '') is null then
    return null;
  end if;

  execute $query$
    select net.http_post(
      url := $1 || '/functions/v1/recipe-import-worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || $2,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $query$
  into request_id
  using project_url, worker_token;

  return request_id;
exception
  when others then
    raise notice 'recipe-import worker invocation skipped: %', sqlerrm;
    return null;
end;
$$;

create or replace function public.cleanup_expired_recipe_import_sources()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text;
  worker_token text;
  request_id bigint;
  expired_count integer;
begin
  select count(*)::integer
  into expired_count
  from public.recipe_imports
  where source_path is not null
    and expires_at < timezone('utc', now());

  if expired_count = 0 then
    return 0;
  end if;

  -- The existing recipe-import Edge Function performs the actual deletion
  -- with storage.remove(). The request is authenticated with the worker token;
  -- no database-side storage metadata deletion is used here.
  if to_regnamespace('vault') is null or to_regnamespace('net') is null then
    raise notice 'recipe-import cleanup skipped: Vault or pg_net is unavailable';
    return 0;
  end if;

  execute $query$
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1),
      (select decrypted_secret from vault.decrypted_secrets where name = 'recipe_import_worker_token' limit 1)
  $query$
  into project_url, worker_token;

  if nullif(project_url, '') is null or nullif(worker_token, '') is null then
    raise notice 'recipe-import cleanup skipped: required Vault secrets are absent';
    return 0;
  end if;

  -- Cleanup runs before the Edge Function validates importId. A fixed
  -- nonexistent ID is deliberate: it invokes only the function's protected
  -- expired-source reaper and cannot process a user import.
  execute $query$
    select net.http_post(
      url := $1 || '/functions/v1/recipe-import',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || $2,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('importId', '00000000-0000-0000-0000-000000000000')
    )
  $query$
  into request_id
  using project_url, worker_token;

  return expired_count;
exception
  when others then
    raise notice 'recipe-import cleanup invocation skipped: %', sqlerrm;
    return 0;
end;
$$;

revoke all on function public.invoke_recipe_import_worker() from public, anon, authenticated;
revoke all on function public.cleanup_expired_recipe_import_sources() from public, anon, authenticated;
grant execute on function public.invoke_recipe_import_worker() to service_role;
grant execute on function public.cleanup_expired_recipe_import_sources() to service_role;

-- Replace the old direct-SQL cleanup schedule and add a guarded worker
-- schedule. Both jobs are harmless no-ops until pg_net plus the expected Vault
-- secrets are configured. The Edge Function itself remains token-protected.
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron is unavailable; worker and cleanup schedules were not created';
    return;
  end if;

  begin
    perform cron.unschedule('recipe-import-source-cleanup');
  exception
    when others then
      raise notice 'existing recipe-import cleanup schedule not removed: %', sqlerrm;
  end;

  begin
    perform cron.unschedule('recipe-import-worker');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'recipe-import-worker',
    '* * * * *',
    'select public.invoke_recipe_import_worker();'
  );

  perform cron.schedule(
    'recipe-import-source-cleanup',
    '15 * * * *',
    'select public.cleanup_expired_recipe_import_sources();'
  );
exception
  when others then
    raise notice 'pg_cron schedule setup skipped safely: %', sqlerrm;
end;
$$;
