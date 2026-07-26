-- ============================================================
-- MIGRAÇÃO: posição das mesas no mapa do salão (croqui)
-- Rode só isso no SQL Editor do Supabase
-- ============================================================

alter table public.bar_tables add column if not exists pos_x numeric;
alter table public.bar_tables add column if not exists pos_y numeric;

-- pos_x e pos_y são porcentagens (0 a 100) relativas ao croqui.
-- Distribui as mesas existentes num arranjo inicial dentro da área interna
-- (você reposiciona arrastando no app depois — isso é só um ponto de partida).
update public.bar_tables
set
  pos_x = 20 + (((number - 1) % 4) * 20),
  pos_y = 45 + (((number - 1) / 4) * 22)
where pos_x is null;
