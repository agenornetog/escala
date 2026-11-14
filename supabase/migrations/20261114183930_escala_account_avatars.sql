insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('escala-account-avatars', 'escala-account-avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy escala_account_avatar_read on storage.objects for select to authenticated
using (bucket_id = 'escala-account-avatars' and split_part(name, '/', 1) = (select auth.uid()::text));

create policy escala_account_avatar_insert on storage.objects for insert to authenticated
with check (bucket_id = 'escala-account-avatars' and split_part(name, '/', 1) = (select auth.uid()::text));

create policy escala_account_avatar_update on storage.objects for update to authenticated
using (bucket_id = 'escala-account-avatars' and split_part(name, '/', 1) = (select auth.uid()::text))
with check (bucket_id = 'escala-account-avatars' and split_part(name, '/', 1) = (select auth.uid()::text));

create policy escala_account_avatar_delete on storage.objects for delete to authenticated
using (bucket_id = 'escala-account-avatars' and split_part(name, '/', 1) = (select auth.uid()::text));
