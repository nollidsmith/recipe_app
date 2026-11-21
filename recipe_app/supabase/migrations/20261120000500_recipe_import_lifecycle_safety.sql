-- Free-plan safety defaults for T-009.

-- A client may delete an import row only after its temporary Storage object has
-- already been removed. This prevents orphaned files when a queued or failed
-- job is deleted before cleanup runs.
drop policy if exists "Users can delete their own non-processing recipe imports"
on public.recipe_imports;

create policy "Users can delete cleaned recipe imports"
on public.recipe_imports for delete to authenticated
using (auth.uid() = user_id and source_path is null and status <> 'processing');

-- Do not enqueue work unless pg_net, Vault, and the worker schedule are all
-- available. This keeps the free Development project on the safe inline path
-- instead of accumulating messages that no worker can consume.
create or replace function public.enqueue_recipe_import_job()
returns trigger
language plpgsql
security definer
set search_path = public, pgmq
as $$
begin
  if to_regnamespace('net') is null
     or to_regnamespace('vault') is null
     or to_regclass('cron.job') is null
     or not exists (select 1 from cron.job where jobname = 'recipe-import-worker') then
    return new;
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'recipe_import_worker_token') then
    return new;
  end if;

  perform pgmq.send('recipe-imports', jsonb_build_object('import_id', new.id), 30);
  return new;
exception
  when others then
    raise notice 'recipe-import queue enqueue skipped: %', sqlerrm;
    return new;
end;
$$;

revoke all on function public.enqueue_recipe_import_job() from public, anon, authenticated;
grant execute on function public.enqueue_recipe_import_job() to service_role;
