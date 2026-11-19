-- PantryPilot pantry item images.

alter table public.pantry_items
  add column image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pantry-images', 'pantry-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users can view their own pantry images"
on storage.objects for select
using (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can upload their own pantry images"
on storage.objects for insert
with check (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update their own pantry images"
on storage.objects for update
using (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can delete their own pantry images"
on storage.objects for delete
using (
  bucket_id = 'pantry-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
