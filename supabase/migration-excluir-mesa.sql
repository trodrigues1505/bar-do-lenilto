-- ============================================================
-- MIGRAÇÃO: permitir exclusão de mesas (só admin)
-- Rode só isso no SQL Editor do Supabase
-- ============================================================

drop policy if exists "admin_delete_tables" on public.bar_tables;
create policy "admin_delete_tables" on public.bar_tables for delete using (public.is_admin());
