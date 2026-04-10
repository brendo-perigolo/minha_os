-- ==========================================================
-- ELETROCED - Migração Status ABERTO
-- Execute este SQL no Supabase SQL Editor para atualizar 
-- seu banco de dados adicionando a opção 'ABERTO'.
-- ==========================================================

-- 1. Remove a restrição antiga que não permitia "aberto"
ALTER TABLE ordens_servico DROP CONSTRAINT IF EXISTS ordens_servico_status_check;

-- 2. Adiciona a nova restrição permitindo o campo 'aberto' e todos os já existentes
ALTER TABLE ordens_servico ADD CONSTRAINT ordens_servico_status_check 
  CHECK (status IN ('aberto', 'orcamento', 'aprovado', 'em_andamento', 'concluido', 'cancelado'));

-- 3. Define o valor padrão das próximas O.S como 'aberto' ao invés de 'orcamento'
ALTER TABLE ordens_servico ALTER COLUMN status SET DEFAULT 'aberto';
