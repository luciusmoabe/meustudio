-- ============================================================
-- MeuStudio — Épico 9: Módulo Financeiro Contábil
-- Tabelas: financeiro_categorias, financeiro_lancamentos
-- Plataforma: Supabase (PostgreSQL)
-- NOTA: Esta é a versão ATUALIZADA que inclui Despesas Recorrentes
-- ============================================================

-- ============================================================
-- TABELA 1: financeiro_categorias (Plano de Contas Simplificado)
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_categorias (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id    UUID        NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    nome            TEXT        NOT NULL,
    tipo            TEXT        NOT NULL DEFAULT 'DESPESA'
        CHECK (tipo IN ('RECEITA', 'DESPESA')),
    icone           TEXT        DEFAULT 'circle',
    cor             TEXT        DEFAULT '#6366f1',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE financeiro_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo gerencia suas categorias" ON financeiro_categorias;
CREATE POLICY "Fotógrafo gerencia suas categorias"
    ON financeiro_categorias FOR ALL
    USING (fotografo_id IN (
        SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
    ))
    WITH CHECK (fotografo_id IN (
        SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
    ));


-- ============================================================
-- TABELA 2: financeiro_lancamentos (Contas a Pagar — Despesas)
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id        UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    categoria_id        UUID            REFERENCES financeiro_categorias(id) ON DELETE SET NULL,

    tipo                TEXT            NOT NULL DEFAULT 'DESPESA'
        CHECK (tipo IN ('RECEITA', 'DESPESA')),
    natureza            TEXT            NOT NULL DEFAULT 'VARIAVEL'
        CHECK (natureza IN ('FIXA', 'VARIAVEL')),
    descricao           TEXT            NOT NULL,
    valor_previsto      NUMERIC(10,2)   NOT NULL,
    valor_realizado     NUMERIC(10,2),

    data_vencimento     DATE            NOT NULL,
    data_pagamento      DATE,

    status              TEXT            NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO')),

    comprovante_url     TEXT,           -- URL do Storage (futura implementação)
    observacao          TEXT,

    recorrente          BOOLEAN         DEFAULT FALSE,
    recorrencia_meses   INTEGER,        -- 1 = mensal, 3 = trimestral, etc.
    recorrente_ate      DATE,           -- Mês final da recorrência (inclusive)
    grupo_recorrencia   UUID,           -- Agrupa lançamentos da mesma série recorrente

    created_at          TIMESTAMPTZ     DEFAULT now(),
    updated_at          TIMESTAMPTZ     DEFAULT now()
);

-- RLS
ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo gerencia seus lançamentos" ON financeiro_lancamentos;
CREATE POLICY "Fotógrafo gerencia seus lançamentos"
    ON financeiro_lancamentos FOR ALL
    USING (fotografo_id IN (
        SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
    ))
    WITH CHECK (fotografo_id IN (
        SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
    ));

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_timestamp_financeiro_lancamentos ON financeiro_lancamentos;
CREATE TRIGGER set_timestamp_financeiro_lancamentos
    BEFORE UPDATE ON financeiro_lancamentos
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Índices
CREATE INDEX IF NOT EXISTS idx_fin_lanc_fotografo     ON financeiro_lancamentos(fotografo_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_status        ON financeiro_lancamentos(fotografo_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_vencimento    ON financeiro_lancamentos(fotografo_id, data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_tipo          ON financeiro_lancamentos(fotografo_id, tipo);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_categoria     ON financeiro_lancamentos(categoria_id);
