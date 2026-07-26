-- ============================================================
-- MIGRAÇÃO: sistema de troféus com níveis
-- ============================================================

-- Atribui um item lançado a um cliente específico (opcional) — é isso
-- que permite contar quantas vezes CADA cliente pediu um produto.
alter table public.order_items add column if not exists customer_id uuid references public.profiles(id);

create table if not exists public.trophies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text default '🏆',
  product_id uuid references public.products(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.trophy_levels (
  id uuid primary key default gen_random_uuid(),
  trophy_id uuid references public.trophies(id) on delete cascade,
  threshold int not null,
  title text not null,
  sort_order int not null default 0
);

alter table public.trophies enable row level security;
alter table public.trophy_levels enable row level security;

drop policy if exists "select_trophies" on public.trophies;
create policy "select_trophies" on public.trophies for select using (auth.role() = 'authenticated');
drop policy if exists "admin_insert_trophies" on public.trophies;
create policy "admin_insert_trophies" on public.trophies for insert with check (public.is_admin());
drop policy if exists "admin_update_trophies" on public.trophies;
create policy "admin_update_trophies" on public.trophies for update using (public.is_admin());
drop policy if exists "admin_delete_trophies" on public.trophies;
create policy "admin_delete_trophies" on public.trophies for delete using (public.is_admin());

drop policy if exists "select_trophy_levels" on public.trophy_levels;
create policy "select_trophy_levels" on public.trophy_levels for select using (auth.role() = 'authenticated');
drop policy if exists "admin_insert_trophy_levels" on public.trophy_levels;
create policy "admin_insert_trophy_levels" on public.trophy_levels for insert with check (public.is_admin());
drop policy if exists "admin_update_trophy_levels" on public.trophy_levels;
create policy "admin_update_trophy_levels" on public.trophy_levels for update using (public.is_admin());
drop policy if exists "admin_delete_trophy_levels" on public.trophy_levels;
create policy "admin_delete_trophy_levels" on public.trophy_levels for delete using (public.is_admin());

-- Devolve, pro próprio cliente logado, o progresso em cada troféu:
-- quantas vezes já pediu o produto, o nível atual desbloqueado e o próximo nível.
create or replace function public.get_my_trophies()
returns table(
  trophy_id uuid, trophy_name text, description text, icon text,
  product_name text, count int,
  current_level_title text, current_threshold int,
  next_level_title text, next_threshold int
)
language sql
security definer
stable
as $$
  with counts as (
    select t.id as trophy_id,
      coalesce(sum(oi.qty) filter (where oi.customer_id = auth.uid() and oi.product_id = t.product_id), 0)::int as cnt
    from public.trophies t
    left join public.order_items oi on oi.product_id = t.product_id and oi.customer_id = auth.uid()
    group by t.id
  )
  select
    t.id, t.name, t.description, t.icon, p.name, c.cnt,
    cur.title, cur.threshold,
    nxt.title, nxt.threshold
  from public.trophies t
  left join public.products p on p.id = t.product_id
  join counts c on c.trophy_id = t.id
  left join lateral (
    select title, threshold from public.trophy_levels
    where trophy_id = t.id and threshold <= c.cnt
    order by threshold desc limit 1
  ) cur on true
  left join lateral (
    select title, threshold from public.trophy_levels
    where trophy_id = t.id and threshold > c.cnt
    order by threshold asc limit 1
  ) nxt on true;
$$;

grant execute on function public.get_my_trophies() to authenticated;
