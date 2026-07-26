-- ============================================================
-- MIGRAÇÃO: check-in de clientes na mesa + pagamentos flexíveis
-- ============================================================

create table if not exists public.table_checkins (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.bar_tables(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete cascade,
  checked_in_at timestamptz default now(),
  checked_in_by uuid references public.profiles(id),
  unique (table_id, customer_id)
);

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  amount numeric(10,2) not null,
  payer_customer_id uuid references public.profiles(id),
  method text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.table_checkins enable row level security;
alter table public.order_payments enable row level security;

drop policy if exists "staff_select_checkins" on public.table_checkins;
create policy "staff_select_checkins" on public.table_checkins for select using (public.is_staff());
drop policy if exists "staff_insert_checkins" on public.table_checkins;
create policy "staff_insert_checkins" on public.table_checkins for insert with check (public.is_staff());
drop policy if exists "staff_delete_checkins" on public.table_checkins;
create policy "staff_delete_checkins" on public.table_checkins for delete using (public.is_staff());

drop policy if exists "staff_select_order_payments" on public.order_payments;
create policy "staff_select_order_payments" on public.order_payments for select using (public.is_staff());
drop policy if exists "staff_insert_order_payments" on public.order_payments;
create policy "staff_insert_order_payments" on public.order_payments for insert with check (public.is_staff());

-- Devolve, pro próprio cliente logado, em quais mesas ele está e o saldo de cada uma
create or replace function public.get_my_tables()
returns table(table_id uuid, table_number int, total numeric, pending numeric)
language sql
security definer
stable
as $$
  select
    bt.id,
    bt.number,
    coalesce((
      select sum(oi.unit_price * oi.qty)
      from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.table_id = bt.id and o.status = 'aberto'
    ), 0) as total,
    greatest(0, coalesce((
      select sum(oi.unit_price * oi.qty)
      from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.table_id = bt.id and o.status = 'aberto'
    ), 0)
    - coalesce((
      select sum(oi.unit_price * oi.paid_qty)
      from public.order_items oi join public.orders o on o.id = oi.order_id
      where o.table_id = bt.id and o.status = 'aberto'
    ), 0)
    - coalesce((
      select sum(op.amount)
      from public.order_payments op join public.orders o on o.id = op.order_id
      where o.table_id = bt.id and o.status = 'aberto'
    ), 0)) as pending
  from public.table_checkins tc
  join public.bar_tables bt on bt.id = tc.table_id
  where tc.customer_id = auth.uid();
$$;
grant execute on function public.get_my_tables() to authenticated;

-- Verifica em quais outras mesas um cliente já está (usado pro aviso de duplicidade)
create or replace function public.customer_active_tables(p_customer_id uuid)
returns table(table_id uuid, table_number int)
language sql
security definer
stable
as $$
  select bt.id, bt.number
  from public.table_checkins tc
  join public.bar_tables bt on bt.id = tc.table_id
  where tc.customer_id = p_customer_id and public.is_staff();
$$;
grant execute on function public.customer_active_tables(uuid) to authenticated;
