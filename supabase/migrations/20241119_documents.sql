-- Documents feature schema
-- Safe/idempotent DDL for documents, shares and requests.

-- helper to keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- main documents table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  type_id text not null,
  name text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  status text not null default 'uploaded', -- uploaded | pending | shared | rejected | expired
  expires_at timestamptz,
  review_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_documents_owner on public.documents(owner_profile_id);
create index if not exists idx_documents_type on public.documents(type_id);
create index if not exists idx_documents_status on public.documents(status);

drop trigger if exists trg_documents_updated_at on public.documents;
create trigger trg_documents_updated_at
before update on public.documents
for each row
execute function public.set_updated_at();

-- document sharing table
create table if not exists public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  shared_with_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create index if not exists idx_document_shares_doc on public.document_shares(document_id);
create index if not exists idx_document_shares_profile on public.document_shares(shared_with_profile_id);

-- optional: requests from steel to supplier
create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references public.profiles(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  type_id text not null,
  note text,
  status text not null default 'open', -- open | fulfilled | closed
  created_at timestamptz not null default timezone('utc', now()),
  fulfilled_at timestamptz
);

create index if not exists idx_doc_requests_target on public.document_requests(target_profile_id);
create index if not exists idx_doc_requests_requester on public.document_requests(requester_profile_id);

-- RLS
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;
alter table public.document_requests enable row level security;

-- policies for documents
drop policy if exists documents_owner_select on public.documents;
create policy documents_owner_select on public.documents
  for select using (auth.uid() = owner_profile_id);

drop policy if exists documents_owner_insert on public.documents;
create policy documents_owner_insert on public.documents
  for insert with check (auth.uid() = owner_profile_id);

drop policy if exists documents_owner_update on public.documents;
create policy documents_owner_update on public.documents
  for update using (auth.uid() = owner_profile_id) with check (auth.uid() = owner_profile_id);

drop policy if exists documents_shared_select on public.documents;
create policy documents_shared_select on public.documents
  for select using (
    exists (
      select 1 from public.document_shares ds
      where ds.document_id = documents.id
        and ds.revoked_at is null
        and ds.shared_with_profile_id = auth.uid()
    )
  );

-- document_shares policies
drop policy if exists document_shares_owner_manage on public.document_shares;
create policy document_shares_owner_manage on public.document_shares
  for all using (
    exists (
      select 1 from public.documents d
      where d.id = document_shares.document_id
        and d.owner_profile_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.documents d
      where d.id = document_shares.document_id
        and d.owner_profile_id = auth.uid()
    )
  );

drop policy if exists document_shares_shared_select on public.document_shares;
create policy document_shares_shared_select on public.document_shares
  for select using (
    document_shares.shared_with_profile_id = auth.uid()
    or exists (
      select 1 from public.documents d
      where d.id = document_shares.document_id
        and d.owner_profile_id = auth.uid()
    )
  );

-- document_requests policies
drop policy if exists document_requests_insert on public.document_requests;
create policy document_requests_insert on public.document_requests
  for insert with check (requester_profile_id = auth.uid());

drop policy if exists document_requests_select on public.document_requests;
create policy document_requests_select on public.document_requests
  for select using (
    requester_profile_id = auth.uid()
    or target_profile_id = auth.uid()
  );

drop policy if exists document_requests_update on public.document_requests;
create policy document_requests_update on public.document_requests
  for update using (
    requester_profile_id = auth.uid()
    or target_profile_id = auth.uid()
  ) with check (
    requester_profile_id = auth.uid()
    or target_profile_id = auth.uid()
  );

-- helper functions for front-end
create or replace function public.create_document(
  p_owner uuid,
  p_type text,
  p_name text,
  p_mime text,
  p_size bigint,
  p_path text
) returns public.documents as $$
declare
  result public.documents;
begin
  insert into public.documents (owner_profile_id, type_id, name, mime_type, size_bytes, storage_path)
  values (p_owner, p_type, p_name, p_mime, p_size, p_path)
  returning * into result;
  return result;
end;
$$ language plpgsql;

create or replace function public.share_document(p_document uuid, p_target uuid)
returns public.document_shares as $$
declare
  result public.document_shares;
begin
  insert into public.document_shares (document_id, shared_with_profile_id)
  values (p_document, p_target)
  returning * into result;
  return result;
end;
$$ language plpgsql;

create or replace function public.revoke_document_share(p_document uuid, p_target uuid)
returns void as $$
begin
  update public.document_shares
  set revoked_at = timezone('utc', now())
  where document_id = p_document
    and shared_with_profile_id = p_target
    and revoked_at is null;
end;
$$ language plpgsql;
