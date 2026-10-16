-- Resolve QR chat ownership through the single active outlet; restaurant_tables has no owner_id.
-- Allow active staff profiles to access their owner's customer chat threads and send replies.
create or replace function public.create_public_cashier_chat(p_table_code text, p_customer_name text default 'Customer')
returns table(thread_id uuid, access_token uuid, table_name text)
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_table public.restaurant_tables%rowtype;
  v_thread public.cashier_chat_threads%rowtype;
  v_owner_id uuid;
begin
  select * into v_table from public.restaurant_tables where code = p_table_code limit 1;
  if not found then raise exception 'Meja tidak ditemukan'; end if;

  select min(o.owner_id::text)::uuid into v_owner_id
  from public.outlets o where o.is_active = true having count(*) = 1;
  if v_owner_id is null then raise exception 'Outlet aktif belum bisa ditentukan. Hubungi kasir.'; end if;

  insert into public.cashier_chat_threads(owner_id, table_id, table_code, table_name, customer_name)
  values (v_owner_id, v_table.id, v_table.code, v_table.name, coalesce(nullif(trim(p_customer_name), ''), 'Customer'))
  returning * into v_thread;
  return query select v_thread.id, v_thread.access_token, v_thread.table_name;
end;
$$;

drop policy if exists "cashier chat staff threads" on public.cashier_chat_threads;
create policy "cashier chat staff threads" on public.cashier_chat_threads for all to authenticated
using (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.staff_profiles sp where sp.user_id = (select auth.uid())
      and sp.owner_id = cashier_chat_threads.owner_id and sp.is_active = true
  )
)
with check (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.staff_profiles sp where sp.user_id = (select auth.uid())
      and sp.owner_id = cashier_chat_threads.owner_id and sp.is_active = true
  )
);

drop policy if exists "cashier chat staff messages" on public.cashier_chat_messages;
create policy "cashier chat staff messages" on public.cashier_chat_messages for all to authenticated
using (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.staff_profiles sp where sp.user_id = (select auth.uid())
      and sp.owner_id = cashier_chat_messages.owner_id and sp.is_active = true
  )
)
with check (
  owner_id = (select auth.uid()) or exists (
    select 1 from public.staff_profiles sp where sp.user_id = (select auth.uid())
      and sp.owner_id = cashier_chat_messages.owner_id and sp.is_active = true
  )
);

create or replace function public.send_cashier_chat(p_thread_id uuid, p_body text)
returns uuid language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare v_id uuid;
begin
  if length(trim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Pesan kosong atau terlalu panjang';
  end if;
  insert into public.cashier_chat_messages(thread_id, owner_id, sender_role, body)
  select t.id, t.owner_id, 'cashier', trim(p_body)
  from public.cashier_chat_threads t
  where t.id = p_thread_id and t.status = 'open'
    and (t.owner_id = (select auth.uid()) or exists (
      select 1 from public.staff_profiles sp where sp.user_id = (select auth.uid())
        and sp.owner_id = t.owner_id and sp.is_active = true
    ))
  returning id into v_id;
  if v_id is null then raise exception 'Chat tidak ditemukan atau akun tidak memiliki akses'; end if;
  update public.cashier_chat_threads set last_message_at = now() where id = p_thread_id;
  return v_id;
end;
$$;
