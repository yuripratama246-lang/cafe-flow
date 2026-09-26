-- Permanently delete an order and its dependent items/payments.
-- Only an active Owner profile may execute this operation.
create or replace function public.delete_order_with_details(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.staff_profiles sp
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
  -- FK ON DELETE CASCADE removes order_items and payments atomically.
end;
$$;

revoke all on function public.delete_order_with_details(uuid) from public;
grant execute on function public.delete_order_with_details(uuid) to authenticated;
