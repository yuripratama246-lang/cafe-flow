-- Keep normal order access permission-based, but reserve DELETE for active Owners.
drop policy if exists "orders staff all" on public.orders;
drop policy if exists "orders auth access" on public.orders;
drop policy if exists "orders_auth_access" on public.orders;
drop policy if exists "orders staff select" on public.orders;
drop policy if exists "orders staff insert" on public.orders;
drop policy if exists "orders staff update" on public.orders;
drop policy if exists "orders owner delete" on public.orders;

create policy "orders_auth_select" on public.orders
  for select to authenticated using (public.has_permission('orders'));
create policy "orders_auth_insert" on public.orders
  for insert to authenticated with check (public.has_permission('orders'));
create policy "orders_auth_update" on public.orders
  for update to authenticated using (public.has_permission('orders'))
  with check (public.has_permission('orders'));
create policy "orders_owner_delete" on public.orders
  for delete to authenticated
  using (exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.role = 'owner'
      and sp.is_active = true
  ));

-- Only an active Owner may execute this atomic permanent deletion.
create or replace function public.delete_order_with_details(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.role = 'owner'
      and sp.is_active = true
  ) then
    raise exception 'Hanya Owner aktif yang boleh menghapus transaksi'
      using errcode = '42501';
  end if;

  delete from public.orders where id = p_order_id;
  if not found then
    raise exception 'Transaksi tidak ditemukan';
  end if;
  -- Existing ON DELETE CASCADE foreign keys remove order_items and payments.
end;
$$;

revoke all on function public.delete_order_with_details(uuid) from public;
grant execute on function public.delete_order_with_details(uuid) to authenticated;
