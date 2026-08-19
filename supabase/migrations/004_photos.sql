-- ============================================================================
-- app-financas — 004_photos.sql
-- Foto de perfil e foto de Espaço (Supabase Storage).
--
-- Dois buckets, ambos com leitura pública (a URL em si não é adivinhável —
-- é um path com o uuid do usuário/Espaço — e foto de perfil/capa não é dado
-- financeiro sensível). Escrita restrita: só o dono da pasta.
-- ============================================================================

alter table spaces add column if not exists photo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('space-photos', 'space-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- avatars/{user_id}/... — só o dono do uuid na pasta escreve
create policy avatars_read on storage.objects for select
  using (bucket_id = 'avatars');

create policy avatars_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- space-photos/{space_id}/... — só membro do Espaço escreve
create policy space_photos_read on storage.objects for select
  using (bucket_id = 'space-photos');

create policy space_photos_write on storage.objects for insert
  with check (
    bucket_id = 'space-photos'
    and is_space_member((storage.foldername(name))[1]::uuid)
  );

create policy space_photos_update on storage.objects for update
  using (
    bucket_id = 'space-photos'
    and is_space_member((storage.foldername(name))[1]::uuid)
  );
