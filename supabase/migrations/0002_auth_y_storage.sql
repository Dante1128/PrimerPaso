-- Integración con Supabase Auth y Storage. Requiere 0001.

-- Al registrarse un usuario se crea su perfil (public.handle_new_user).
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Buckets privados: documentos del KYC y comprobantes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-docs', 'kyc-docs', false, null, null)
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, null, null)
on conflict (id) do nothing;

-- Cada usuario solo accede a su carpeta (kyc-docs/<user_id>/...).
create policy kyc_docs_own on storage.objects
  for all to public
  using (((bucket_id = 'kyc-docs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
  with check (((bucket_id = 'kyc-docs'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

