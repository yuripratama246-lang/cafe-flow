-- Atomically remove one order and its dependent line items/payments.
-- SECURITY INVOKER keeps the caller's table privileges and RLS policies in force.
create or replace function public.delete_order_with_details(p_order_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.order_items where order_id = p_order_id;
  delete from public.payments where order_id = p_order_id;
  delete from public.orders where id = p_order_id;

  if not found then
    raise exception 'Transaksi tidak ditemukan atau tidak memiliki izin untuk dihapus';
  end if;
end;
$$;

revoke all on function public.delete_order_with_details(uuid) from public;
grant execute on function public.delete_order_with_details(uuid) to authenticated;
