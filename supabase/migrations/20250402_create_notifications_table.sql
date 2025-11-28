-- Criar tabela de notificações
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_email text not null references public.profiles(email) on delete cascade,
  type text not null check (type in ('table_modified_by_admin', 'other')),
  title text not null,
  message text not null,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- Índices para performance
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_email, created_at desc);

create index if not exists notifications_read_idx
  on public.notifications (recipient_email, read);

-- Habilitar RLS
alter table public.notifications enable row level security;

-- Policy: usuário só vê suas próprias notificações
drop policy if exists notifications_select_own on public.notifications;
create policy "notifications_select_own"
  on public.notifications
  for select
  using (lower(recipient_email) = lower(auth.email()));

-- Policy: usuário pode marcar como lida suas próprias notificações
drop policy if exists notifications_update_own on public.notifications;
create policy "notifications_update_own"
  on public.notifications
  for update
  using (lower(recipient_email) = lower(auth.email()))
  with check (lower(recipient_email) = lower(auth.email()));
