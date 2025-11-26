-- Storage bucket and RLS policies for supplier documents

-- Create bucket (idempotent)
insert into storage.buckets (id, name, public)
values ('supplier_documents', 'supplier_documents', true)
on conflict (id) do update set public = excluded.public;

-- Helper to match owner folder (first path segment equals auth.uid())
create or replace function public.is_owner_folder(name text)
returns boolean
language sql
immutable
as $$
  select split_part(name, '/', 1) = auth.uid()::text;
$$;

-- Insert: only authenticated users uploading to their own folder in this bucket
drop policy if exists supplier_documents_insert on storage.objects;
create policy supplier_documents_insert
on storage.objects
for insert
with check (
  bucket_id = 'supplier_documents'
  and auth.role() = 'authenticated'
  and public.is_owner_folder(name)
);

-- Select: allow public read in this bucket (objects are shared via public URL)
drop policy if exists supplier_documents_select on storage.objects;
create policy supplier_documents_select
on storage.objects
for select
using (bucket_id = 'supplier_documents');

-- Update/Delete: only owner can manage their own objects
drop policy if exists supplier_documents_update on storage.objects;
create policy supplier_documents_update
on storage.objects
for update
using (
  bucket_id = 'supplier_documents'
  and auth.role() = 'authenticated'
  and public.is_owner_folder(name)
)
with check (
  bucket_id = 'supplier_documents'
  and auth.role() = 'authenticated'
  and public.is_owner_folder(name)
);

drop policy if exists supplier_documents_delete on storage.objects;
create policy supplier_documents_delete
on storage.objects
for delete
using (
  bucket_id = 'supplier_documents'
  and auth.role() = 'authenticated'
  and public.is_owner_folder(name)
);
