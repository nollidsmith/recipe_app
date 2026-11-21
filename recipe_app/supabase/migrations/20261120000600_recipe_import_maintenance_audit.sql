-- Durable audit state for asynchronous worker and cleanup invocations.
-- The request ID alone is not evidence that pg_net completed successfully.

create table if not exists public.recipe_import_maintenance_runs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('worker', 'cleanup')),
  request_id bigint,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  http_status integer,
  error_message text,
  requested_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

revoke all on public.recipe_import_maintenance_runs from public, anon, authenticated;

create or replace function public.reconcile_recipe_import_maintenance_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row record;
  response_code integer;
  response_error text;
  reconciled integer := 0;
begin
  if to_regclass('net._http_response') is null then
    return 0;
  end if;

  for run_row in select id, request_id from public.recipe_import_maintenance_runs where status = 'pending' and request_id is not null loop
    begin
      execute 'select status_code, error_msg from net._http_response where id = $1'
        into response_code, response_error using run_row.request_id;
      if response_code is not null then
        update public.recipe_import_maintenance_runs
        set status = case when response_code between 200 and 299 then 'succeeded' else 'failed' end,
            http_status = response_code,
            error_message = nullif(response_error, ''),
            completed_at = timezone('utc', now())
        where id = run_row.id;
        reconciled := reconciled + 1;
      end if;
    exception when others then
      update public.recipe_import_maintenance_runs
      set status = 'failed', error_message = left(sqlerrm, 500), completed_at = timezone('utc', now())
      where id = run_row.id;
      reconciled := reconciled + 1;
    end;
  end loop;
  return reconciled;
end;
$$;

revoke all on function public.reconcile_recipe_import_maintenance_runs() from public, anon, authenticated;
grant execute on function public.reconcile_recipe_import_maintenance_runs() to service_role;

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
  select count(*)::integer into expired_count
  from public.recipe_imports
  where source_path is not null and expires_at < timezone('utc', now());
  if expired_count = 0 then return 0; end if;
  if to_regnamespace('vault') is null or to_regnamespace('net') is null then
    insert into public.recipe_import_maintenance_runs (kind, status, error_message)
    values ('cleanup', 'failed', 'Vault or pg_net is unavailable');
    return 0;
  end if;
  execute $query$
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1),
      (select decrypted_secret from vault.decrypted_secrets where name = 'recipe_import_worker_token' limit 1)
  $query$ into project_url, worker_token;
  if nullif(project_url, '') is null or nullif(worker_token, '') is null then
    insert into public.recipe_import_maintenance_runs (kind, status, error_message)
    values ('cleanup', 'failed', 'Required Vault secrets are absent');
    return 0;
  end if;
  execute $query$
    select net.http_post(
      url := $1 || '/functions/v1/recipe-import',
      headers := jsonb_build_object('Authorization', 'Bearer ' || $2, 'Content-Type', 'application/json'),
      body := jsonb_build_object('importId', '00000000-0000-0000-0000-000000000000')
    )
  $query$ into request_id using project_url, worker_token;
  insert into public.recipe_import_maintenance_runs (kind, request_id) values ('cleanup', request_id);
  return expired_count;
exception when others then
  insert into public.recipe_import_maintenance_runs (kind, status, error_message)
  values ('cleanup', 'failed', left(sqlerrm, 500));
  return 0;
end;
$$;

revoke all on function public.cleanup_expired_recipe_import_sources() from public, anon, authenticated;
grant execute on function public.cleanup_expired_recipe_import_sources() to service_role;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.schedule('recipe-import-maintenance-reconcile', '*/5 * * * *', 'select public.reconcile_recipe_import_maintenance_runs();');
  end if;
exception when others then
  raise notice 'maintenance audit schedule skipped: %', sqlerrm;
end;
$$;
