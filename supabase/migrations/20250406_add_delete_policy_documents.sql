-- Add DELETE policy for documents table
-- This policy allows users to delete their own documents

-- Drop existing delete policy if exists (idempotent)
drop policy if exists documents_owner_delete on public.documents;

-- Create DELETE policy: users can delete their own documents
create policy documents_owner_delete on public.documents
  for delete using (auth.uid() = owner_profile_id);
