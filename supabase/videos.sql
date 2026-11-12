-- Run once in Supabase SQL Editor, after schema.sql and admin.sql.
-- Keep video limits independent of the existing image bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ameza-videos', 'ameza-videos', true, 52428800, array['video/mp4', 'video/webm'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read AMEZA videos" on storage.objects;
create policy "public read AMEZA videos" on storage.objects
  for select to public using (bucket_id = 'ameza-videos');

drop policy if exists "admin upload AMEZA videos" on storage.objects;
create policy "admin upload AMEZA videos" on storage.objects
  for insert to authenticated with check (bucket_id = 'ameza-videos' and public.is_admin());

drop policy if exists "restrict AMEZA video uploads to admins" on storage.objects;
create policy "restrict AMEZA video uploads to admins" on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'ameza-videos' or public.is_admin());

drop policy if exists "admin delete AMEZA videos" on storage.objects;
create policy "admin delete AMEZA videos" on storage.objects
  for delete to authenticated using (bucket_id = 'ameza-videos' and public.is_admin());

drop policy if exists "restrict AMEZA video deletes to admins" on storage.objects;
create policy "restrict AMEZA video deletes to admins" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'ameza-videos' or public.is_admin());

-- Uploads use unique paths; updates are intentionally disallowed.
drop policy if exists "restrict AMEZA video updates" on storage.objects;
create policy "restrict AMEZA video updates" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'ameza-videos') with check (bucket_id <> 'ameza-videos');
