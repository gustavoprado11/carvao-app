-- Fix documents table for proper sharing functionality

-- Add description column if not exists
alter table public.documents
add column if not exists description text;

-- Drop existing unique constraint/index if exists (in case of re-running)
alter table public.documents
drop constraint if exists documents_owner_type_unique;

drop index if exists documents_owner_type_unique_idx;

-- Add unique constraint for (owner_profile_id, type_id)
-- BUT exclude 'extra' type_id to allow multiple extra documents
-- This ensures each supplier can only have ONE document per type (except 'extra')
-- When uploading a new version, it will update instead of creating duplicates
create unique index documents_owner_type_unique_idx
on public.documents (owner_profile_id, type_id)
where type_id != 'extra';

-- Update the share_document function to handle duplicates
-- If a share already exists and is not revoked, do nothing
-- If it exists but was revoked, reactivate it
create or replace function public.share_document(p_document uuid, p_target uuid)
returns public.document_shares as $$
declare
  result public.document_shares;
  existing_share public.document_shares;
begin
  -- Check if a share already exists (active or revoked)
  select * into existing_share
  from public.document_shares
  where document_id = p_document
    and shared_with_profile_id = p_target
  limit 1;

  if existing_share.id is not null then
    -- Share exists
    if existing_share.revoked_at is null then
      -- Already active, return it
      return existing_share;
    else
      -- Was revoked, reactivate it
      update public.document_shares
      set revoked_at = null
      where id = existing_share.id
      returning * into result;
      return result;
    end if;
  else
    -- Create new share
    insert into public.document_shares (document_id, shared_with_profile_id)
    values (p_document, p_target)
    returning * into result;
    return result;
  end if;
end;
$$ language plpgsql;
