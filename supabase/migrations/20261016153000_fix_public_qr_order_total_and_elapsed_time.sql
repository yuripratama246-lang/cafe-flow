-- Include the authoritative persisted total and creation timestamp in public QR status.
-- The order UUID is the lookup token; no direct SELECT access to orders is granted.
drop function if exists public.get_public_qr_order_status(uuid);

create function public.get_public_qr_order_status(p_order_id uuid)
returns table (
  id uuid,
  order_no integer,
  status text,
  payment_status text,
  is_paid boolean,
  updated_at timestamptz,
  total numeric,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select o.id, o.order_no, o.status, o.payment_status, o.is_paid, o.updated_at, o.total, o.created_at
  from public.orders o
  where o.id = p_order_id
    and o.source = 'qr'
  limit 1;
$function$;

revoke all on function public.get_public_qr_order_status(uuid) from public;
grant execute on function public.get_public_qr_order_status(uuid) to anon, authenticated;
