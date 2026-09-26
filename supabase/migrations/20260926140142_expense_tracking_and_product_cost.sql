-- Expense tracking and product cost support for Profit & Loss reporting.
-- Safe to run on environments where these objects already exist.

alter table public.products
  add column if not exists cost_price numeric not null default 0;

alter table public.products
  drop constraint if exists products_cost_price_check;

alter table public.products
  add constraint products_cost_price_check check (cost_price >= 0);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  amount numeric not null check (amount > 0),
  category text not null,
  description text not null,
  expense_date date not null default current_date,
  payment_method text not null default 'cash',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

drop policy if exists expenses_owner_all on public.expenses;
create policy expenses_owner_all
on public.expenses
for all
to authenticated
using (
  owner_id = coalesce(
    (select sp.owner_id from public.staff_profiles sp where sp.user_id = auth.uid() limit 1),
    auth.uid()
  )
)
with check (
  owner_id = coalesce(
    (select sp.owner_id from public.staff_profiles sp where sp.user_id = auth.uid() limit 1),
    auth.uid()
  )
);

create index if not exists expenses_owner_date_idx
  on public.expenses (owner_id, expense_date desc);

-- Keep expense create/update/delete actions in the activity log as well.
drop trigger if exists audit_expenses on public.expenses;
create trigger audit_expenses
after insert or update or delete on public.expenses
for each row execute function public.capture_audit_log();
