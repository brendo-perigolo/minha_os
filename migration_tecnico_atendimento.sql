-- ==========================================================
-- ELETROCED - Técnico em Atendimento (OS)
-- Adiciona campo para marcar quem está atendendo a OS
-- Execute no Supabase SQL Editor
-- ==========================================================

alter table public.ordens_servico
add column if not exists tecnico_atendimento text;
