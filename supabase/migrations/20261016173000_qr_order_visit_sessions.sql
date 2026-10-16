-- Isolate public QR order history by a random per-visit token, never by table alone.
alter table public.orders
  add column if not exists qr_session_id uuid;

create index if not exists orders_qr_session_history_idx
  on public.orders (qr_session_id, table_id, created_at desc)
  where source = 'qr' and qr_session_id is not null;

-- Preserve the existing checkout validation and stock logic while persisting the session token.
do $migration$
declare
  v_definition text;
  v_updated text;
begin
  v_definition := pg_get_functiondef('public.create_qr_order(jsonb,jsonb)'::regprocedure);
  v_updated := replace(
    v_definition,
    $old$  v_key uuid := nullif(p_order->>'idempotency_key','')::uuid;$old$,
    $new$  v_key uuid := nullif(p_order->>'idempotency_key','')::uuid;
  v_qr_session_id uuid := nullif(p_order->>'qr_session_id','')::uuid;$new$
  );
  if v_updated = v_definition then
    raise exception 'Could not locate create_qr_order declaration anchor';
  end if;
  v_definition := v_updated;

  v_updated := replace(
    v_definition,
    $old$INSERT INTO public.orders(idempotency_key,outlet_id,order_no,source,status,table_id,customer_name,notes,$old$,
    $new$INSERT INTO public.orders(idempotency_key,qr_session_id,outlet_id,order_no,source,status,table_id,customer_name,notes,$new$
  );
  if v_updated = v_definition then
    raise exception 'Could not locate create_qr_order insert columns anchor';
  end if;
  v_definition := v_updated;

  v_updated := replace(
    v_definition,
    $old$VALUES(v_key,v_outlet_id,nextval('public.orders_order_no_seq'),'qr','new',v_table_id,$old$,
    $new$VALUES(v_key,v_qr_session_id,v_outlet_id,nextval('public.orders_order_no_seq'),'qr','new',v_table_id,$new$
  );
  if v_updated = v_definition then
    raise exception 'Could not locate create_qr_order values anchor';
  end if;

  execute v_updated;
end
$migration$;

create or replace function public.get_public_qr_order_history(
  p_session_id uuid,
  p_table_code text
)
returns table (
  id uuid,
  order_no bigint,
  status text,
  payment_status text,
  total numeric,
  created_at timestamptz,
  items jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    o.id,
    o.order_no,
    o.status,
    o.payment_status,
    o.total,
    o.created_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'product_name', oi.product_name,
          'quantity', oi.quantity,
          'line_total', oi.line_total
        ) order by oi.id
      )
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb) as items
  from public.orders o
  join public.restaurant_tables t on t.id = o.table_id
  where o.source = 'qr'
    and o.qr_session_id = p_session_id
    and t.code = p_table_code
  order by o.created_at desc
  limit 50;
$function$;

revoke all on function public.get_public_qr_order_history(uuid, text) from public;
grant execute on function public.get_public_qr_order_history(uuid, text) to anon, authenticated;
