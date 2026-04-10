-- ==========================================================
-- ELETROCED - Migração (Controle de Estoque)
-- Movimentações de Entrada e Atualização de saldo em produtos
-- Execute este SQL no Supabase SQL Editor
-- ==========================================================

-- 1) Tabela de movimentações de estoque
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id BIGSERIAL PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade NUMERIC(10,3) NOT NULL,
  descricao TEXT,
  estoque_anterior INTEGER,
  estoque_atual INTEGER,
  ordem_id BIGINT REFERENCES ordens_servico(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_produto ON estoque_movimentos(produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_created_at ON estoque_movimentos(created_at DESC);

-- 2) RLS + policies (mantém padrão do projeto)
ALTER TABLE estoque_movimentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Allow all estoque_movimentos anon" ON estoque_movimentos
  FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Allow all estoque_movimentos auth" ON estoque_movimentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Compatibilidade para ambientes onde a tabela já existia
ALTER TABLE estoque_movimentos ADD COLUMN IF NOT EXISTS ordem_id BIGINT REFERENCES ordens_servico(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE estoque_movimentos ALTER COLUMN quantidade TYPE NUMERIC(10,3);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN datatype_mismatch THEN NULL;
END $$;

-- 2.0) Ajuste de constraint de quantidade:
-- - entrada/saida: quantidade > 0
-- - ajuste: quantidade pode ser positiva ou negativa, mas não zero
DO $$
DECLARE
  c RECORD;
BEGIN
  -- remove checks antigos que bloqueiam quantidade negativa
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.estoque_movimentos'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%quantidade%> 0%'
  LOOP
    EXECUTE format('ALTER TABLE public.estoque_movimentos DROP CONSTRAINT %I', c.conname);
  END LOOP;

  BEGIN
    ALTER TABLE public.estoque_movimentos
      ADD CONSTRAINT chk_estoque_mov_quantidade
      CHECK (
        (tipo IN ('entrada','saida') AND quantidade > 0)
        OR (tipo = 'ajuste' AND quantidade <> 0)
      );
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 2.1) Colunas de controle na OS (para baixa automática / estorno)
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS estoque_baixado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ;

-- 3) Função RPC para registrar entrada (atômico com lock)
CREATE OR REPLACE FUNCTION registrar_entrada_estoque(
  p_produto_id BIGINT,
  p_quantidade NUMERIC,
  p_descricao TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_anterior INTEGER;
  v_atual INTEGER;
  v_delta INTEGER;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade inválida';
  END IF;

  IF p_quantidade <> TRUNC(p_quantidade) THEN
    RAISE EXCEPTION 'Quantidade deve ser inteira';
  END IF;

  v_delta := p_quantidade::INTEGER;

  SELECT estoque INTO v_anterior
  FROM produtos
  WHERE id = p_produto_id
  FOR UPDATE;

  IF v_anterior IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  v_atual := v_anterior + v_delta;

  UPDATE produtos
  SET estoque = v_atual
  WHERE id = p_produto_id;

  INSERT INTO estoque_movimentos (
    produto_id,
    tipo,
    quantidade,
    descricao,
    estoque_anterior,
    estoque_atual,
    created_by
  ) VALUES (
    p_produto_id,
    'entrada',
    p_quantidade,
    p_descricao,
    v_anterior,
    v_atual,
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_entrada_estoque(BIGINT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION registrar_entrada_estoque(BIGINT, NUMERIC, TEXT) TO authenticated;

-- 3.1) RPC: Ajuste de estoque pelo Cadastro de Produto (gera movimento tipo 'ajuste')
CREATE OR REPLACE FUNCTION ajustar_estoque_cadastro(
  p_produto_id BIGINT,
  p_novo_estoque INTEGER,
  p_descricao TEXT DEFAULT 'Ajuste Cadastro'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_anterior INTEGER;
  v_atual INTEGER;
  v_delta INTEGER;
  v_desc TEXT;
BEGIN
  IF p_novo_estoque IS NULL OR p_novo_estoque < 0 THEN
    RAISE EXCEPTION 'Estoque inválido';
  END IF;

  SELECT estoque INTO v_anterior
  FROM produtos
  WHERE id = p_produto_id
  FOR UPDATE;

  IF v_anterior IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  v_atual := p_novo_estoque;
  v_delta := v_atual - v_anterior;

  IF v_delta = 0 THEN
    RETURN;
  END IF;

  UPDATE produtos
  SET estoque = v_atual
  WHERE id = p_produto_id;

  v_desc := COALESCE(NULLIF(p_descricao, ''), 'Ajuste Cadastro') || format(' (de %s para %s)', v_anterior, v_atual);

  INSERT INTO estoque_movimentos (
    produto_id,
    tipo,
    quantidade,
    descricao,
    estoque_anterior,
    estoque_atual,
    created_by
  ) VALUES (
    p_produto_id,
    'ajuste',
    v_delta,
    v_desc,
    v_anterior,
    v_atual,
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ajustar_estoque_cadastro(BIGINT, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION ajustar_estoque_cadastro(BIGINT, INTEGER, TEXT) TO authenticated;

-- 4) View de estoque (Total / Reservado / Livre)
CREATE OR REPLACE VIEW vw_produtos_estoque AS
SELECT
  p.*,
  COALESCE(
    SUM(op.quantidade) FILTER (WHERE os.status <> 'cancelado' AND os.estoque_baixado IS DISTINCT FROM true),
    0
  ) AS estoque_reservado,
  (p.estoque - COALESCE(
    SUM(op.quantidade) FILTER (WHERE os.status <> 'cancelado' AND os.estoque_baixado IS DISTINCT FROM true),
    0
  )) AS estoque_livre
FROM produtos p
LEFT JOIN ordem_produtos op ON op.produto_id = p.id
LEFT JOIN ordens_servico os ON os.id = op.ordem_id
GROUP BY p.id;

-- 5) RPC: Concluir OS (baixa automática do estoque)
CREATE OR REPLACE FUNCTION concluir_ordem_servico(p_ordem_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_baixado BOOLEAN;
  r RECORD;
  v_anterior INTEGER;
  v_atual INTEGER;
  v_qtd_int INTEGER;
BEGIN
  SELECT status, estoque_baixado
  INTO v_status, v_baixado
  FROM ordens_servico
  WHERE id = p_ordem_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  IF v_status = 'cancelado' THEN
    RAISE EXCEPTION 'OS cancelada';
  END IF;

  IF v_baixado = true THEN
    UPDATE ordens_servico
    SET status = 'concluido',
        concluida_em = COALESCE(concluida_em, NOW())
    WHERE id = p_ordem_id;
    RETURN;
  END IF;

  FOR r IN
    SELECT produto_id, SUM(quantidade) AS qtd
    FROM ordem_produtos
    WHERE ordem_id = p_ordem_id
    GROUP BY produto_id
  LOOP
    IF r.qtd <> TRUNC(r.qtd) THEN
      RAISE EXCEPTION 'Quantidade do produto % deve ser inteira', r.produto_id;
    END IF;

    v_qtd_int := r.qtd::INTEGER;

    SELECT estoque INTO v_anterior
    FROM produtos
    WHERE id = r.produto_id
    FOR UPDATE;

    IF v_anterior IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado: %', r.produto_id;
    END IF;

    IF v_anterior < v_qtd_int THEN
      RAISE EXCEPTION 'Estoque insuficiente para produto %', r.produto_id;
    END IF;

    v_atual := v_anterior - v_qtd_int;

    UPDATE produtos
    SET estoque = v_atual
    WHERE id = r.produto_id;

    INSERT INTO estoque_movimentos (
      produto_id,
      ordem_id,
      tipo,
      quantidade,
      descricao,
      estoque_anterior,
      estoque_atual,
      created_by
    ) VALUES (
      r.produto_id,
      p_ordem_id,
      'saida',
      r.qtd,
      'Baixa automática - OS concluída',
      v_anterior,
      v_atual,
      auth.uid()
    );
  END LOOP;

  UPDATE ordens_servico
  SET status = 'concluido',
      estoque_baixado = true,
      concluida_em = NOW()
  WHERE id = p_ordem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION concluir_ordem_servico(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION concluir_ordem_servico(BIGINT) TO authenticated;

-- 6) RPC: Estornar OS (devolve estoque e reabre como ABERTO)
CREATE OR REPLACE FUNCTION estornar_ordem_servico(p_ordem_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_baixado BOOLEAN;
  r RECORD;
  v_anterior INTEGER;
  v_atual INTEGER;
  v_qtd_int INTEGER;
BEGIN
  SELECT status, estoque_baixado
  INTO v_status, v_baixado
  FROM ordens_servico
  WHERE id = p_ordem_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  IF v_baixado IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'OS não está concluída/baixada para estornar';
  END IF;

  FOR r IN
    SELECT produto_id, SUM(quantidade) AS qtd
    FROM ordem_produtos
    WHERE ordem_id = p_ordem_id
    GROUP BY produto_id
  LOOP
    IF r.qtd <> TRUNC(r.qtd) THEN
      RAISE EXCEPTION 'Quantidade do produto % deve ser inteira', r.produto_id;
    END IF;

    v_qtd_int := r.qtd::INTEGER;

    SELECT estoque INTO v_anterior
    FROM produtos
    WHERE id = r.produto_id
    FOR UPDATE;

    IF v_anterior IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado: %', r.produto_id;
    END IF;

    v_atual := v_anterior + v_qtd_int;

    UPDATE produtos
    SET estoque = v_atual
    WHERE id = r.produto_id;

    INSERT INTO estoque_movimentos (
      produto_id,
      ordem_id,
      tipo,
      quantidade,
      descricao,
      estoque_anterior,
      estoque_atual,
      created_by
    ) VALUES (
      r.produto_id,
      p_ordem_id,
      'entrada',
      r.qtd,
      'Estorno - OS reaberta',
      v_anterior,
      v_atual,
      auth.uid()
    );
  END LOOP;

  UPDATE ordens_servico
  SET status = 'aberto',
      estoque_baixado = false,
      concluida_em = NULL
  WHERE id = p_ordem_id;
END;
$$;

GRANT EXECUTE ON FUNCTION estornar_ordem_servico(BIGINT) TO anon;
GRANT EXECUTE ON FUNCTION estornar_ordem_servico(BIGINT) TO authenticated;
