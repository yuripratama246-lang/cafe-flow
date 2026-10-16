-- Public QR status must include the persisted order total so the customer status page
-- can show the real amount even when the initial create RPC response is partial.
drop function if exists public.get_public_qr_order_status(uuid);

create function public.get_public_qr_order_status(p_order_id uuid)
returns table (
  id uuid,
  order_no integer,
  status text,
  payment_status text,
  is_paid boolean,
  updated_at timestamptz,
  total numeric
)
language sql
stable
security definer
set search_path = ''
as $function$
  select o.id, o.order_no, o.status, o.payment_status, o.is_paid, o.updated_at, o.total
  from public.orders o
  where o.id = p_order_id
    and o.source = 'qr'
  limit 1;
$function$;

revoke all on function public.get_public_qr_order_status(uuid) from public;
grant execute on function public.get_public_qr_order_status(uuid) to anon, authenticated;
