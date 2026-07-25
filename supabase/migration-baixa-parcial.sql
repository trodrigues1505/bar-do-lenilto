-- ============================================================
-- MIGRAÇÃO: baixa parcial de itens (rodar só isso no SQL Editor
-- se o seu banco já existe — não precisa rodar o schema.sql inteiro de novo)
-- ============================================================

alter table public.order_items add column if not exists paid_qty int not null default 0;

create table if not exists public.order_item_payments (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid references public.order_items(id) on delete cascade,
  qty int not null,
  amount numeric(10,2) not null,
  settled_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.order_item_payments enable row level security;

drop policy if exists "staff_select_payments" on public.order_item_payments;
create policy "staff_select_payments" on public.order_item_payments for select using (public.is_staff());

drop policy if exists "staff_insert_payments" on public.order_item_payments;
create policy "staff_insert_payments" on public.order_item_payments for insert with check (public.is_staff());
