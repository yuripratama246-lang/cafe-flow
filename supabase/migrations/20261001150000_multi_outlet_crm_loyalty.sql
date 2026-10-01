-- Multi-outlet inventory and customer loyalty foundation.
create extension if not exists pgcrypto;
create table if not exists public.outlets (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null, code text, address text, phone text, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(owner_id,code)
);
create table if not exists public.warehouses (
 id uuid primary key default gen_random_uuid(), outlet_id uuid not null references public.outlets(id) on delete cascade,
 name text not null, warehouse_type text not null default 'RAW_MATERIAL', is_active boolean not null default true,
 created_at timestamptz not null default now(), unique(outlet_id,name)
);
create table if not exists public.warehouse_stocks (
 id uuid primary key default gen_random_uuid(), warehouse_id uuid not null references public.warehouses(id) on delete cascade,
 item_id uuid not null, item_name text not null, quantity numeric(14,3) not null default 0 check(quantity>=0),
 unit text not null default 'unit', updated_at timestamptz not null default now(), unique(warehouse_id,item_id)
);
create table if not exists public.stock_transfers (
 id uuid primary key default gen_random_uuid(), from_warehouse_id uuid not null references public.warehouses(id),
 to_warehouse_id uuid not null references public.warehouses(id), item_id uuid not null, item_name text not null,
 quantity numeric(14,3) not null check(quantity>0), status text not null default 'PENDING'
 check(status in ('PENDING','IN_TRANSIT','COMPLETED','CANCELLED')),
 requested_by uuid references auth.users(id), received_by uuid references auth.users(id), notes text,
 created_at timestamptz not null default now(), completed_at timestamptz, check(from_warehouse_id<>to_warehouse_id)
);
alter table public.customers add column if not exists outlet_id uuid references public.outlets(id) on delete set null;
alter table public.customers add column if not exists loyalty_updated_at timestamptz;
create table if not exists public.point_redemptions (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
 points integer not null check(points>0), reward_description text not null,
 status text not null default 'PENDING' check(status in ('PENDING','APPROVED','REJECTED','FULFILLED')),
 redeemed_at timestamptz not null default now(), fulfilled_at timestamptz
);
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.orders add column if not exists outlet_id uuid references public.outlets(id) on delete set null;
create table if not exists public.loyalty_point_earnings (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.orders(id) on delete cascade,
 customer_id uuid not null references public.customers(id) on delete cascade, points integer not null check(points>0),
 created_at timestamptz not null default now()
);
create or replace function public.add_loyalty_points_on_checkout()
returns trigger language plpgsql security definer set search_path=public as $$
declare earned integer;
begin
 if new.status='SUCCESS' and new.customer_id is not null
 and (tg_op='INSERT' or old.status is distinct from 'SUCCESS') then
  earned:=floor(coalesce(new.total,0)/10000)::integer;
  if earned>0 then
   insert into public.loyalty_point_earnings(order_id,customer_id,points) values(new.id,new.customer_id,earned)
   on conflict(order_id) do nothing;
   if found then update public.customers set points=coalesce(points,0)+earned,
    total_spend=coalesce(total_spend,0)+coalesce(new.total,0), visit_count=coalesce(visit_count,0)+1,
    loyalty_updated_at=now(),updated_at=now() where id=new.customer_id; end if;
  end if;
 end if; return new;
end; $$;
drop trigger if exists trg_add_loyalty_points_on_checkout on public.orders;
create trigger trg_add_loyalty_points_on_checkout after insert or update of status on public.orders
for each row execute function public.add_loyalty_points_on_checkout();
create index if not exists idx_warehouses_outlet on public.warehouses(outlet_id);
create index if not exists idx_warehouse_stocks_warehouse on public.warehouse_stocks(warehouse_id);
create index if not exists idx_stock_transfers_status on public.stock_transfers(status);
create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_point_redemptions_customer on public.point_redemptions(customer_id);
alter table public.outlets enable row level security;
alter table public.warehouses enable row level security;
alter table public.warehouse_stocks enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.point_redemptions enable row level security;
alter table public.loyalty_point_earnings enable row level security;
drop policy if exists outlets_owner_all on public.outlets;
create policy outlets_owner_all on public.outlets for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists warehouses_owner_all on public.warehouses;
create policy warehouses_owner_all on public.warehouses for all to authenticated using(exists(select 1 from public.outlets o where o.id=outlet_id and o.owner_id=auth.uid())) with check(exists(select 1 from public.outlets o where o.id=outlet_id and o.owner_id=auth.uid()));
drop policy if exists warehouse_stocks_owner_all on public.warehouse_stocks;
create policy warehouse_stocks_owner_all on public.warehouse_stocks for all to authenticated using(exists(select 1 from public.warehouses w join public.outlets o on o.id=w.outlet_id where w.id=warehouse_id and o.owner_id=auth.uid())) with check(exists(select 1 from public.warehouses w join public.outlets o on o.id=w.outlet_id where w.id=warehouse_id and o.owner_id=auth.uid()));
drop policy if exists stock_transfers_owner_all on public.stock_transfers;
create policy stock_transfers_owner_all on public.stock_transfers for all to authenticated using(exists(select 1 from public.warehouses w join public.outlets o on o.id=w.outlet_id where w.id=from_warehouse_id and o.owner_id=auth.uid()) and exists(select 1 from public.warehouses w join public.outlets o on o.id=w.outlet_id where w.id=to_warehouse_id and o.owner_id=auth.uid())) with check(exists(select 1 from public.warehouses w join public.outlets o on o.id=w.outlet_id where w.id=from_warehouse_id and o.owner_id=auth.uid()) and exists(select 1 from public.warehouses w join public.outlets o on o.id=w.outlet_id where w.id=to_warehouse_id and o.owner_id=auth.uid()));
drop policy if exists point_redemptions_customer_owner on public.point_redemptions;
create policy point_redemptions_customer_owner on public.point_redemptions for all to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.owner_id=auth.uid())) with check(exists(select 1 from public.customers c where c.id=customer_id and c.owner_id=auth.uid()));
drop policy if exists loyalty_earnings_customer_owner on public.loyalty_point_earnings;
create policy loyalty_earnings_customer_owner on public.loyalty_point_earnings for select to authenticated using(exists(select 1 from public.customers c where c.id=customer_id and c.owner_id=auth.uid()));
