do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;

    drop policy if exists profiles_select_self on public.profiles;
    drop policy if exists profiles_insert_self on public.profiles;
    drop policy if exists profiles_update_self on public.profiles;
  end if;

  if to_regclass('public.conversations') is not null then
    alter table public.conversations enable row level security;

    drop policy if exists conversations_participants_select on public.conversations;
    drop policy if exists conversations_participants_write on public.conversations;
  end if;

  if to_regclass('public.conversation_messages') is not null then
    alter table public.conversation_messages enable row level security;

    drop policy if exists conversation_messages_participants_select on public.conversation_messages;
    drop policy if exists conversation_messages_participants_insert on public.conversation_messages;
  end if;
exception
  when others then
    null;
end;
$$;

create policy profiles_select_self on public.profiles
  for select using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  );

create policy profiles_insert_self on public.profiles
  for insert with check (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy profiles_update_self on public.profiles
  for update using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  )
  with check (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  );

create policy conversations_participants_select on public.conversations
  for select using (
    lower(supplier_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or lower(steel_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  );

create policy conversations_participants_write on public.conversations
  for all using (
    lower(supplier_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or lower(steel_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  )
  with check (
    lower(supplier_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or lower(steel_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
  );

create policy conversation_messages_participants_select on public.conversation_messages
  for select using (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_messages.conversation_id
        and (
          lower(c.supplier_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          or lower(c.steel_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
        )
    )
  );

create policy conversation_messages_participants_insert on public.conversation_messages
  for insert with check (
    lower(sender_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and (
          lower(c.supplier_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          or lower(c.steel_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          or coalesce(auth.jwt() ->> 'profile_type', '') = 'admin'
        )
    )
  );
