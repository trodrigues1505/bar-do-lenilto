-- ============================================================
-- MIGRAÇÃO: sistema de pontos de clientes + estoque
-- Rode no SQL Editor do Supabase (se ainda não rodou a migração
-- "admin_delete_tables" de excluir mesa, roda ela também — sem
-- ela, excluir mesa não funciona, mesmo sem dar erro visível)
-- ============================================================

-- garante a permissão de excluir mesa (caso ainda não tenha rodado)
drop policy if exists "admin_delete_tables" on public.bar_tables;
create policy "admin_delete_tables" on public.bar_tables for delete using (public.is_admin());

-- ------------------------------------------------------------
-- Vincula um cliente cadastrado à mesa/pedido (opcional)
-- ------------------------------------------------------------
alter table public.orders add column if not exists customer_id uuid references public.profiles(id);

-- ------------------------------------------------------------
-- Sistema de pontos
-- ------------------------------------------------------------
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete cascade,
  points int not null,
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.app_settings (
  id int primary key default 1,
  leaderboard_visible boolean not null default true,
  points_per_real numeric not null default 1,
  constraint single_row check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

alter table public.loyalty_transactions enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "staff_select_loyalty" on public.loyalty_transactions;
create policy "staff_select_loyalty" on public.loyalty_transactions for select using (public.is_staff());
drop policy if exists "staff_insert_loyalty" on public.loyalty_transactions;
create policy "staff_insert_loyalty" on public.loyalty_transactions for insert with check (public.is_staff());

drop policy if exists "select_settings" on public.app_settings;
create policy "select_settings" on public.app_settings for select using (auth.role() = 'authenticated');
drop policy if exists "admin_update_settings" on public.app_settings;
create policy "admin_update_settings" on public.app_settings for update using (public.is_admin());

-- Função que devolve o ranking (mês ou geral) sem expor os motivos das
-- baixas de pontos — respeita o interruptor de visibilidade pra quem
-- não é staff.
create or replace function public.get_leaderboard(period text default 'all')
returns table(customer_id uuid, full_name text, email text, total_points bigint)
language plpgsql
security definer
stable
as $$
declare
  visible boolean;
begin
  select leaderboard_visible into visible from public.app_settings where id = 1;
  if not public.is_staff() and not coalesce(visible, true) then
    return;
  end if;

  return query
    select p.id, p.full_name, p.email, coalesce(sum(t.points), 0)::bigint as total_points
    from public.profiles p
    join public.loyalty_transactions t on t.customer_id = p.id
    where period = 'all' or t.created_at >= date_trunc('month', now())
    group by p.id, p.full_name, p.email
    order by total_points desc
    limit 50;
end;
$$;

grant execute on function public.get_leaderboard(text) to authenticated;

-- ------------------------------------------------------------
-- Estoque
-- ------------------------------------------------------------
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'un',
  qty numeric not null default 0,
  min_qty numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.product_stock_usage (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  stock_item_id uuid references public.stock_items(id) on delete cascade,
  qty_per_unit numeric not null default 1,
  unique (product_id, stock_item_id)
);

alter table public.stock_items enable row level security;
alter table public.product_stock_usage enable row level security;

drop policy if exists "staff_select_stock" on public.stock_items;
create policy "staff_select_stock" on public.stock_items for select using (public.is_staff());
drop policy if exists "admin_insert_stock" on public.stock_items;
create policy "admin_insert_stock" on public.stock_items for insert with check (public.is_admin());
drop policy if exists "staff_update_stock" on public.stock_items;
create policy "staff_update_stock" on public.stock_items for update using (public.is_staff());
drop policy if exists "admin_delete_stock" on public.stock_items;
create policy "admin_delete_stock" on public.stock_items for delete using (public.is_admin());

drop policy if exists "staff_select_usage" on public.product_stock_usage;
create policy "staff_select_usage" on public.product_stock_usage for select using (public.is_staff());
drop policy if exists "admin_insert_usage" on public.product_stock_usage;
create policy "admin_insert_usage" on public.product_stock_usage for insert with check (public.is_admin());
drop policy if exists "admin_update_usage" on public.product_stock_usage;
create policy "admin_update_usage" on public.product_stock_usage for update using (public.is_admin());
drop policy if exists "admin_delete_usage" on public.product_stock_usage;
create policy "admin_delete_usage" on public.product_stock_usage for delete using (public.is_admin());
