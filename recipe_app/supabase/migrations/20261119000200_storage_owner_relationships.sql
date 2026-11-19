-- PantryPilot storage ownership hardening.
-- Object paths are {user_id}/recipes/{recipe_id}/{image_id} and
-- {user_id}/pantry/{pantry_item_id}/{image_id}. The referenced row must belong
-- to the authenticated user as well as the first path segment.

drop policy if exists "Recipe image owners can view their files" on storage.objects;
drop policy if exists "Recipe image owners can upload files" on storage.objects;
drop policy if exists "Recipe image owners can update files" on storage.objects;
drop policy if exists "Recipe image owners can delete files" on storage.objects;

create policy "Recipe image owners can view their files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.recipes
    where recipes.id::text = (storage.foldername(name))[3]
      and recipes.user_id = (select auth.uid())
  )
);

create policy "Recipe image owners can upload files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.recipes
    where recipes.id::text = (storage.foldername(name))[3]
      and recipes.user_id = (select auth.uid())
  )
);

create policy "Recipe image owners can update files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.recipes
    where recipes.id::text = (storage.foldername(name))[3]
      and recipes.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.recipes
    where recipes.id::text = (storage.foldername(name))[3]
      and recipes.user_id = (select auth.uid())
  )
);

create policy "Recipe image owners can delete files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'recipe-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.recipes
      where recipes.id::text = (storage.foldername(name))[3]
      and recipes.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can view their own pantry images" on storage.objects;
drop policy if exists "Users can upload their own pantry images" on storage.objects;
drop policy if exists "Users can update their own pantry images" on storage.objects;
drop policy if exists "Users can delete their own pantry images" on storage.objects;

create policy "Users can view their own pantry images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.pantry_items
    where pantry_items.id::text = (storage.foldername(name))[3]
      and pantry_items.user_id = (select auth.uid())
  )
);

create policy "Users can upload their own pantry images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.pantry_items
    where pantry_items.id::text = (storage.foldername(name))[3]
      and pantry_items.user_id = (select auth.uid())
  )
);

create policy "Users can update their own pantry images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.pantry_items
    where pantry_items.id::text = (storage.foldername(name))[3]
      and pantry_items.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.pantry_items
    where pantry_items.id::text = (storage.foldername(name))[3]
      and pantry_items.user_id = (select auth.uid())
  )
);

create policy "Users can delete their own pantry images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.pantry_items
      where pantry_items.id::text = (storage.foldername(name))[3]
      and pantry_items.user_id = (select auth.uid())
  )
);
