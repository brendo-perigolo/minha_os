-- ==========================================================
-- ELETROCED - Migração (Atualização de Equipamentos e OS)
-- Execute este SQL no Supabase SQL Editor para atualizar 
-- seu banco de dados sem perder dados existentes.
-- ==========================================================

-- 1. Cria a Tabela de Equipamentos do Cliente
CREATE TABLE IF NOT EXISTS equipamentos (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
  modelo TEXT NOT NULL,
  marca TEXT,
  numero_serie TEXT,
  voltagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adiciona as novas colunas na tabela de Ordens de Serviço
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS equipamento_id BIGINT REFERENCES equipamentos(id) ON DELETE SET NULL;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS problema_reclamado TEXT;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS condicao_pagamento TEXT;

-- 3. Habilitar segurança padrão da tabela de equipamentos (RLS)
ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;

-- 4. Definir acesso à tabela de equipamentos
CREATE POLICY "Allow all equipamentos anon" ON equipamentos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth equipamentos" ON equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
