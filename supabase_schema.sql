-- =====================================================
-- ELETROCED - Sistema de Ordem de Serviço
-- Execute este SQL no Supabase SQL Editor
-- =====================================================

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Equipamentos do Cliente
CREATE TABLE IF NOT EXISTS equipamentos (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
  modelo TEXT NOT NULL,
  marca TEXT,
  numero_serie TEXT,
  voltagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS produtos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  estoque INTEGER DEFAULT 0,
  unidade TEXT DEFAULT 'un',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Movimentações de Estoque (Entradas/Saídas/Ajustes)
CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id BIGSERIAL PRIMARY KEY,
  produto_id BIGINT NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','ajuste')),
  quantidade NUMERIC(10,3) NOT NULL,
  descricao TEXT,
  estoque_anterior INTEGER,
  estoque_atual INTEGER,
  ordem_id BIGINT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint de quantidade:
-- - entrada/saida: quantidade > 0
-- - ajuste: quantidade pode ser positiva ou negativa, mas não zero
DO $$
DECLARE
  c RECORD;
BEGIN
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

-- Tabela de Serviços
CREATE TABLE IF NOT EXISTS servicos (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Ordens de Serviço
CREATE TABLE IF NOT EXISTS ordens_servico (
  id BIGSERIAL PRIMARY KEY,
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  equipamento_id BIGINT REFERENCES equipamentos(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','orcamento','aprovado','em_andamento','concluido','cancelado')),
  estoque_baixado BOOLEAN NOT NULL DEFAULT false,
  concluida_em TIMESTAMPTZ,
  problema_reclamado TEXT,
  observacoes TEXT,
  condicao_pagamento TEXT,
  total NUMERIC(10,2) DEFAULT 0,
  metodo_pagamento TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibilidade para bancos já existentes
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS estoque_baixado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ordens_servico ADD COLUMN IF NOT EXISTS concluida_em TIMESTAMPTZ;

-- FK para ordem_id (ordens_servico precisa existir)
ALTER TABLE estoque_movimentos ADD COLUMN IF NOT EXISTS ordem_id BIGINT;
ALTER TABLE estoque_movimentos
  ADD CONSTRAINT estoque_movimentos_ordem_id_fkey
  FOREIGN KEY (ordem_id) REFERENCES ordens_servico(id) ON DELETE SET NULL;

-- Tabela de Produtos da OS
CREATE TABLE IF NOT EXISTS ordem_produtos (
  id BIGSERIAL PRIMARY KEY,
  ordem_id BIGINT REFERENCES ordens_servico(id) ON DELETE CASCADE,
  produto_id BIGINT REFERENCES produtos(id) ON DELETE SET NULL,
  quantidade NUMERIC(10,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED
);

-- Tabela de Serviços da OS
CREATE TABLE IF NOT EXISTS ordem_servicos (
  id BIGSERIAL PRIMARY KEY,
  ordem_id BIGINT REFERENCES ordens_servico(id) ON DELETE CASCADE,
  servico_id BIGINT REFERENCES servicos(id) ON DELETE SET NULL,
  quantidade NUMERIC(10,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED
);

-- Tabela de Movimentações de Caixa
CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id BIGSERIAL PRIMARY KEY,
  ordem_id BIGINT REFERENCES ordens_servico(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  metodo_pagamento TEXT,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS com acesso público (ajuste conforme necessário)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordem_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixa_movimentos ENABLE ROW LEVEL SECURITY;

-- Policies para 'anon' (Somente para facilitar os primeiros testes)
CREATE POLICY "Allow all clientes" ON clientes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all equipamentos" ON equipamentos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all produtos" ON produtos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all estoque_movimentos" ON estoque_movimentos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all servicos" ON servicos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ordens_servico" ON ordens_servico FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ordem_produtos" ON ordem_produtos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ordem_servicos" ON ordem_servicos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all caixa" ON caixa_movimentos FOR ALL TO anon USING (true) WITH CHECK (true);

-- Policies para 'authenticated' (Usuários Logados) - ESSENCIAL PARA 403 FORBIDDEN
CREATE POLICY "Allow auth clientes" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth equipamentos" ON equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth produtos" ON produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth estoque_movimentos" ON estoque_movimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Função RPC para registrar entrada de estoque (atômico)
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
    ordem_id,
    created_by
  ) VALUES (
    p_produto_id,
    'entrada',
    p_quantidade,
    p_descricao,
    v_anterior,
    v_atual,
    NULL,
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION registrar_entrada_estoque(BIGINT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION registrar_entrada_estoque(BIGINT, NUMERIC, TEXT) TO authenticated;

-- RPC: Ajuste de estoque pelo Cadastro de Produto (gera movimento tipo 'ajuste')
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
    ordem_id,
    created_by
  ) VALUES (
    p_produto_id,
    'ajuste',
    v_delta,
    v_desc,
    v_anterior,
    v_atual,
    NULL,
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ajustar_estoque_cadastro(BIGINT, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION ajustar_estoque_cadastro(BIGINT, INTEGER, TEXT) TO authenticated;

-- View de estoque (Total / Reservado / Livre)
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

-- RPC: Concluir OS (baixa automática do estoque)
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

-- RPC: Estornar OS (devolve estoque e reabre como ABERTO)
CREATE OR REPLACE FUNCTION estornar_ordem_servico(p_ordem_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_baixado BOOLEAN;
  r RECORD;
  v_anterior INTEGER;
  v_atual INTEGER;
  v_qtd_int INTEGER;
BEGIN
  SELECT estoque_baixado
  INTO v_baixado
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
CREATE POLICY "Allow auth servicos" ON servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth ordens_servico" ON ordens_servico FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth ordem_produtos" ON ordem_produtos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth ordem_servicos" ON ordem_servicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow auth caixa" ON caixa_movimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de Usuários (Perfis de Restrição / RBAC) vinculada ao Supabase Auth
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_licenca BOOLEAN DEFAULT true,
  is_administrador BOOLEAN DEFAULT false,
  is_vendedor BOOLEAN DEFAULT false,
  is_caixa BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
-- Permite leitura de perfis para autenticados e publicos na versao de testes. (Ajustar em producao)
CREATE POLICY "Allow all usuarios anon" ON usuarios FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow all usuarios auth" ON usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
