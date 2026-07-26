-- ============================================================
-- Bar do Lenilto — Schema do Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Project > SQL Editor > New query > colar tudo > Run)
-- ============================================================

-- PERFIS (liga o usuário autenticado a um papel: admin / funcionario / cliente)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text not null default 'cliente' check (role in ('admin','funcionario','cliente')),
  created_at timestamptz default now()
);

-- Cria o perfil automaticamente quando alguém faz login pela primeira vez
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- PRODUTOS
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  category text default 'Geral',
  created_at timestamptz default now()
);

-- MESAS
create table if not exists public.bar_tables (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  status text not null default 'livre' check (status in ('livre','ocupada')),
  pos_x numeric,
  pos_y numeric,
  created_at timestamptz default now()
);

-- PEDIDOS (um pedido "aberto" por mesa por vez)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references public.bar_tables(id) on delete cascade,
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  opened_at timestamptz default now(),
  closed_at timestamptz,
  opened_by uuid references public.profiles(id),
  total numeric(10,2) default 0
);

-- ITENS DO PEDIDO
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  unit_price numeric(10,2) not null,
  qty int not null default 1,
  paid_qty int not null default 0
);

-- BAIXAS PARCIAIS (histórico de quem pagou o quê, útil quando a mesa tem
-- mais de um pagante e cada um quita só a própria parte)
create table if not exists public.order_item_payments (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references public.order_items(id) on delete cascade,
  qty int not null,
  amount numeric(10,2) not null,
  settled_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.bar_tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_payments enable row level security;

create or replace function public.is_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role in ('admin','funcionario')
  );
$$ language sql security definer stable;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- profiles: cada um vê o próprio; admin vê todos
drop policy if exists "select_own_profile" on public.profiles;
create policy "select_own_profile" on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "admin_updates_profiles" on public.profiles;
create policy "admin_updates_profiles" on public.profiles for update using (public.is_admin());

-- products: qualquer autenticado lê; só admin escreve
drop policy if exists "select_products" on public.products;
create policy "select_products" on public.products for select using (auth.role() = 'authenticated');
drop policy if exists "admin_insert_products" on public.products;
create policy "admin_insert_products" on public.products for insert with check (public.is_admin());
drop policy if exists "admin_update_products" on public.products;
create policy "admin_update_products" on public.products for update using (public.is_admin());
drop policy if exists "admin_delete_products" on public.products;
create policy "admin_delete_products" on public.products for delete using (public.is_admin());

-- bar_tables: qualquer autenticado lê; staff (admin+funcionario) escreve
drop policy if exists "select_tables" on public.bar_tables;
create policy "select_tables" on public.bar_tables for select using (auth.role() = 'authenticated');
drop policy if exists "staff_insert_tables" on public.bar_tables;
create policy "staff_insert_tables" on public.bar_tables for insert with check (public.is_staff());
drop policy if exists "staff_update_tables" on public.bar_tables;
create policy "staff_update_tables" on public.bar_tables for update using (public.is_staff());
drop policy if exists "admin_delete_tables" on public.bar_tables;
create policy "admin_delete_tables" on public.bar_tables for delete using (public.is_admin());

-- orders / order_items: só staff
drop policy if exists "staff_select_orders" on public.orders;
create policy "staff_select_orders" on public.orders for select using (public.is_staff());
drop policy if exists "staff_insert_orders" on public.orders;
create policy "staff_insert_orders" on public.orders for insert with check (public.is_staff());
drop policy if exists "staff_update_orders" on public.orders;
create policy "staff_update_orders" on public.orders for update using (public.is_staff());

drop policy if exists "staff_select_items" on public.order_items;
create policy "staff_select_items" on public.order_items for select using (public.is_staff());
drop policy if exists "staff_insert_items" on public.order_items;
create policy "staff_insert_items" on public.order_items for insert with check (public.is_staff());
drop policy if exists "staff_update_items" on public.order_items;
create policy "staff_update_items" on public.order_items for update using (public.is_staff());
drop policy if exists "staff_delete_items" on public.order_items;
create policy "staff_delete_items" on public.order_items for delete using (public.is_staff());

drop policy if exists "staff_select_payments" on public.order_item_payments;
create policy "staff_select_payments" on public.order_item_payments for select using (public.is_staff());
drop policy if exists "staff_insert_payments" on public.order_item_payments;
create policy "staff_insert_payments" on public.order_item_payments for insert with check (public.is_staff());

-- ============================================================
-- DADOS INICIAIS
-- ============================================================
insert into public.bar_tables (number, pos_x, pos_y)
select n, 20 + ((n - 1) % 4) * 20, 45 + ((n - 1) / 4) * 22
from generate_series(1,10) as n
where not exists (select 1 from public.bar_tables);

insert into public.products (name, price, category)
select * from (values
  ('Chopp Pilsen 300ml', 8.5, 'Bebida'),
  ('Cerveja Long Neck', 9.0, 'Bebida'),
  ('Caipirinha', 14.0, 'Drink'),
  ('Refrigerante Lata', 6.0, 'Bebida'),
  ('Porção de Batata Frita', 28.0, 'Petisco'),
  ('Isca de Frango', 32.0, 'Petisco'),
  ('Água Mineral', 4.5, 'Bebida')
) as v(name, price, category)
where not exists (select 1 from public.products);

-- ============================================================
-- IMPORTANTE: depois de criar sua conta pelo app (login com Google),
-- rode o comando abaixo trocando o e-mail pelo seu, para virar admin:
--
-- update public.profiles set role = 'admin' where email = 'seuemail@gmail.com';
-- ============================================================
