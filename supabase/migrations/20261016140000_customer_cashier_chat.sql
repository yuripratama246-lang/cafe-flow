-- Customer <-> cashier chat for QR Ordering, web POS, and native Android.
create extension if not exists pgcrypto;

create table if not exists public.cashier_chat_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  table_code text not null,
  table_name text not null,
  customer_name text not null default 'Customer',
  access_token uuid not null default gen_random_uuid(),
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists cashier_chat_threads_owner_last_idx on public.cashier_chat_threads(owner_id, last_message_at desc);
create unique index if not exists cashier_chat_threads_access_token_idx on public.cashier_chat_threads(access_token);

create table if not exists public.cashier_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.cashier_chat_threads(id) on delete cascade,
  owner_id uuid not null,
  sender_role text not null check (sender_role in ('customer','cashier')),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists cashier_chat_messages_thread_created_idx on public.cashier_chat_messages(thread_id, created_at);

alter table public.cashier_chat_threads enable row level security;
alter table public.cashier_chat_messages enable row level security;
drop policy if exists "cashier chat staff threads" on public.cashier_chat_threads;
create policy "cashier chat staff threads" on public.cashier_chat_threads for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "cashier chat staff messages" on public.cashier_chat_messages;
create policy "cashier chat staff messages" on public.cashier_chat_messages for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
grant select, insert, update on public.cashier_chat_threads to authenticated;
grant select, insert, update on public.cashier_chat_messages to authenticated;

create or replace function public.create_public_cashier_chat(p_table_code text, p_customer_name text default 'Customer')
returns table(thread_id uuid, access_token uuid, table_name text)
language plpgsql security definer set search_path = public
as $$
declare t public.restaurant_tables%rowtype; v_thread public.cashier_chat_threads%rowtype;
begin
 select * into t from public.restaurant_tables where code = p_table_code limit 1;
 if not found then raise exception 'Meja tidak ditemukan'; end if;
 insert into public.cashier_chat_threads(owner_id, table_id, table_code, table_name, customer_name)
 values (t.owner_id, t.id, t.code, t.name, coalesce(nullif(trim(p_customer_name),''),'Customer'))
 returning * into v_thread;
 return query select v_thread.id, v_thread.access_token, v_thread.table_name;
end $$;

create or replace function public.send_public_cashier_chat(p_access_token uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_thread public.cashier_chat_threads%rowtype; v_id uuid;
begin
 if length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Pesan kosong atau terlalu panjang'; end if;
 select * into v_thread from public.cashier_chat_threads where access_token = p_access_token and status = 'open' limit 1;
 if not found then raise exception 'Sesi chat tidak ditemukan atau sudah ditutup'; end if;
 insert into public.cashier_chat_messages(thread_id, owner_id, sender_role, body)
 values (v_thread.id, v_thread.owner_id, 'customer', trim(p_body)) returning id into v_id;
 update public.cashier_chat_threads set last_message_at = now() where id = v_thread.id;
 return v_id;
end $$;

create or replace function public.read_public_cashier_chat(p_access_token uuid)
returns table(id uuid, sender_role text, body text, created_at timestamptz)
language sql security definer set search_path = public
as $$
 select m.id, m.sender_role, m.body, m.created_at
 from public.cashier_chat_messages m
 join public.cashier_chat_threads t on t.id = m.thread_id
 where t.access_token = p_access_token and t.status = 'open'
 order by m.created_at asc
 limit 300
$$;

create or replace function public.send_cashier_chat(p_thread_id uuid, p_body text)
returns uuid language plpgsql security invoker set search_path = public
as $$
declare v_id uuid;
begin
 if length(trim(coalesce(p_body,''))) not between 1 and 2000 then raise exception 'Pesan kosong atau terlalu panjang'; end if;
 insert into public.cashier_chat_messages(thread_id, owner_id, sender_role, body)
 select t.id, t.owner_id, 'cashier', trim(p_body)
 from public.cashier_chat_threads t where t.id = p_thread_id and t.owner_id = (select auth.uid()) and t.status = 'open'
 returning id into v_id;
 if v_id is null then raise exception 'Chat tidak ditemukan atau sudah ditutup'; end if;
 update public.cashier_chat_threads set last_message_at = now() where id = p_thread_id and owner_id = (select auth.uid());
 return v_id;
end $$;

revoke all on function public.create_public_cashier_chat(text,text) from public;
revoke all on function public.send_public_cashier_chat(uuid,text) from public;
revoke all on function public.read_public_cashier_chat(uuid) from public;
grant execute on function public.create_public_cashier_chat(text,text) to anon, authenticated;
grant execute on function public.send_public_cashier_chat(uuid,text) to anon, authenticated;
grant execute on function public.read_public_cashier_chat(uuid) to anon, authenticated;
revoke all on function public.send_cashier_chat(uuid,text) from public;
grant execute on function public.send_cashier_chat(uuid,text) to authenticated;

do $$ begin
 if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
  alter publication supabase_realtime add table public.cashier_chat_threads;
  alter publication supabase_realtime add table public.cashier_chat_messages;
 end if;
exception when duplicate_object then null;
end $$;
