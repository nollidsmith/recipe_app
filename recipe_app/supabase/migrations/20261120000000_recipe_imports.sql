-- Temporary, user-owned recipe import jobs. Imported recipes are drafts until
-- the user explicitly saves them through the existing recipe form.

create table public.recipe_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_path text,
  source_filename text not null check (char_length(source_filename) between 1 and 120),
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  status text not null default 'queued' check (status in ('queued', 'processing', 'ready', 'needs_review', 'failed')),
  draft_json jsonb,
  confidence_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  expires_at timestamptz not null default timezone('utc', now()) + interval '1 hour',
  provider_request_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index recipe_imports_user_updated_idx on public.recipe_imports (user_id, updated_at desc);
alter table public.recipe_imports enable row level security;

create policy "Users can view their own recipe imports"
on public.recipe_imports for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own queued recipe imports"
on public.recipe_imports for insert to authenticated with check (
  auth.uid() = user_id
  and status = 'queued'
  and source_path = auth.uid()::text || '/' || id::text || '/source/' || source_filename
  and source_filename !~ '[^a-zA-Z0-9._-]'
  and draft_json is null
  and confidence_json = '{}'::jsonb
  and warnings_json = '[]'::jsonb
  and error_code is null
  and error_message is null
  and attempt_count = 0
  and provider_request_id is null
);
create policy "Users can delete their own recipe imports"
on public.recipe_imports for delete to authenticated using (auth.uid() = user_id);

create trigger recipe_imports_set_updated_at
before update on public.recipe_imports
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-imports', 'recipe-imports', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own recipe import sources"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-imports'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[3] = 'source'
  and exists (
    select 1 from public.recipe_imports
    where recipe_imports.id::text = (storage.foldername(name))[2]
      and recipe_imports.user_id = auth.uid()
      and recipe_imports.source_path = name
  )
);

create policy "Users can view their own recipe import sources"
on storage.objects for select to authenticated
using (
  bucket_id = 'recipe-imports'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[3] = 'source'
  and exists (
    select 1 from public.recipe_imports
    where recipe_imports.id::text = (storage.foldername(name))[2]
      and recipe_imports.user_id = auth.uid()
      and recipe_imports.source_path = name
  )
);

create policy "Users can delete their own recipe import sources"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-imports'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[3] = 'source'
  and exists (
    select 1 from public.recipe_imports
    where recipe_imports.id::text = (storage.foldername(name))[2]
      and recipe_imports.user_id = auth.uid()
      and recipe_imports.source_path = name
  )
);
