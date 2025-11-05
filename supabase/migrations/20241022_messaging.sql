-- Ensure the profiles table exists so conversation foreign keys resolve.
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  type text not null check (type in ('supplier', 'steel')),
  company text,
  contact text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Conversations between suppliers and steel companies.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  supplier_email text not null references public.profiles(email) on delete cascade,
  steel_email text not null references public.profiles(email) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (supplier_email, steel_email)
);

comment on table public.conversations is 'Conversation channel between a supplier profile and a steel profile.';
comment on column public.conversations.last_message is 'Stores the last message body for fast previews.';
comment on column public.conversations.last_message_at is 'Timestamp of the last message sent in the conversation.';

-- Messages exchanged inside each conversation.
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_email text not null references public.profiles(email) on delete cascade,
  sender_type text not null check (sender_type in ('supplier', 'steel')),
  body text not null,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.conversation_messages is 'Messages exchanged in each supplier/steel conversation.';
comment on column public.conversation_messages.sender_type is 'Helps determine which side sent the message for rendering.';

create index if not exists conversation_messages_conversation_id_idx
  on public.conversation_messages (conversation_id, created_at);
