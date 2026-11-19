-- Harden storage path shape and relational lookup indexes.
-- Paths are exactly {user_id}/{recipes|pantry}/{row_id}/{object_id};
-- storage.foldername(name) returns the three folder segments and excludes the filename.

drop policy if exists "Recipe image owners can view their files" on storage.objects;
drop policy if exists "Recipe image owners can upload files" on storage.objects;
drop policy if exists "Recipe image owners can update files" on storage.objects;
drop policy if exists "Recipe image owners can delete files" on storage.objects;

create policy "Recipe image owners can view their files"
on storage.objects for select to authenticated
using (
  bucket_id = 'recipe-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'recipes'
  and exists (select 1 from public.recipes where recipes.id::text = (storage.foldername(name))[3] and recipes.user_id = (select auth.uid()))
);

create policy "Recipe image owners can upload files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recipe-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'recipes'
  and exists (select 1 from public.recipes where recipes.id::text = (storage.foldername(name))[3] and recipes.user_id = (select auth.uid()))
);

create policy "Recipe image owners can update files"
on storage.objects for update to authenticated
using (
  bucket_id = 'recipe-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'recipes'
  and exists (select 1 from public.recipes where recipes.id::text = (storage.foldername(name))[3] and recipes.user_id = (select auth.uid()))
)
with check (
  bucket_id = 'recipe-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'recipes'
  and exists (select 1 from public.recipes where recipes.id::text = (storage.foldername(name))[3] and recipes.user_id = (select auth.uid()))
);

create policy "Recipe image owners can delete files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recipe-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'recipes'
  and exists (select 1 from public.recipes where recipes.id::text = (storage.foldername(name))[3] and recipes.user_id = (select auth.uid()))
);

drop policy if exists "Users can view their own pantry images" on storage.objects;
drop policy if exists "Users can upload their own pantry images" on storage.objects;
drop policy if exists "Users can update their own pantry images" on storage.objects;
drop policy if exists "Users can delete their own pantry images" on storage.objects;

create policy "Users can view their own pantry images"
on storage.objects for select to authenticated
using (
  bucket_id = 'pantry-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'pantry'
  and exists (select 1 from public.pantry_items where pantry_items.id::text = (storage.foldername(name))[3] and pantry_items.user_id = (select auth.uid()))
);

create policy "Users can upload their own pantry images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pantry-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'pantry'
  and exists (select 1 from public.pantry_items where pantry_items.id::text = (storage.foldername(name))[3] and pantry_items.user_id = (select auth.uid()))
);

create policy "Users can update their own pantry images"
on storage.objects for update to authenticated
using (
  bucket_id = 'pantry-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'pantry'
  and exists (select 1 from public.pantry_items where pantry_items.id::text = (storage.foldername(name))[3] and pantry_items.user_id = (select auth.uid()))
)
with check (
  bucket_id = 'pantry-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'pantry'
  and exists (select 1 from public.pantry_items where pantry_items.id::text = (storage.foldername(name))[3] and pantry_items.user_id = (select auth.uid()))
);

create policy "Users can delete their own pantry images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pantry-images'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (storage.foldername(name))[2] = 'pantry'
  and exists (select 1 from public.pantry_items where pantry_items.id::text = (storage.foldername(name))[3] and pantry_items.user_id = (select auth.uid()))
);

create index if not exists shopping_list_source_recipe_idx
  on public.shopping_list_items (source_recipe_id);

create index if not exists favorites_recipe_idx
  on public.favorites (recipe_id);
