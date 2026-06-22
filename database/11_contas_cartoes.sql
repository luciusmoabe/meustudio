-- ============================================================
-- MeuStudio — Épico 9: Controle de Contas e Cartões
-- Tabelas: financeiro_contas, financeiro_cartoes
-- ============================================================

-- ============================================================
-- TABELA: financeiro_contas
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_contas (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id    UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    nome            TEXT            NOT NULL, -- Ex: "Nubank PJ", "Caixa Físico"
    tipo            TEXT            NOT NULL DEFAULT 'CORRENTE'
        CHECK (tipo IN ('CORRENTE', 'POUPANCA', 'DINHEIRO', 'OUTROS')),
    saldo_inicial   NUMERIC(10,2)   DEFAULT 0.00,
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

ALTER TABLE financeiro_contas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo gerencia suas contas" ON financeiro_contas;
CREATE POLICY "Fotógrafo gerencia suas contas"
    ON financeiro_contas FOR ALL
    USING (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()))
    WITH CHECK (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS set_timestamp_financeiro_contas ON financeiro_contas;
CREATE TRIGGER set_timestamp_financeiro_contas
    BEFORE UPDATE ON financeiro_contas
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


-- ============================================================
-- TABELA: financeiro_cartoes
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_cartoes (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id    UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    nome            TEXT            NOT NULL, -- Ex: "Cartão Nubank Master"
    dia_fechamento  INTEGER         NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
    dia_vencimento  INTEGER         NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
    limite          NUMERIC(10,2),
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

ALTER TABLE financeiro_cartoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo gerencia seus cartões" ON financeiro_cartoes;
CREATE POLICY "Fotógrafo gerencia seus cartões"
    ON financeiro_cartoes FOR ALL
    USING (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()))
    WITH CHECK (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS set_timestamp_financeiro_cartoes ON financeiro_cartoes;
CREATE TRIGGER set_timestamp_financeiro_cartoes
    BEFORE UPDATE ON financeiro_cartoes
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


-- ============================================================
-- ALTERAÇÕES EM: financeiro_lancamentos
-- ============================================================
ALTER TABLE financeiro_lancamentos 
ADD COLUMN IF NOT EXISTS conta_id           UUID REFERENCES financeiro_contas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS cartao_id          UUID REFERENCES financeiro_cartoes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS forma_pagamento    TEXT 
    CHECK (forma_pagamento IN ('PIX', 'BOLETO', 'DEBITO', 'CREDITO', 'DINHEIRO', 'OUTROS')),
ADD COLUMN IF NOT EXISTS parcela_atual      INTEGER,
ADD COLUMN IF NOT EXISTS total_parcelas     INTEGER;

-- ============================================================
-- ALTERAÇÕES EM: parcelas (Receitas)
-- ============================================================
ALTER TABLE parcelas 
ADD COLUMN IF NOT EXISTS conta_id           UUID REFERENCES financeiro_contas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS forma_pagamento    TEXT 
    CHECK (forma_pagamento IN ('PIX', 'BOLETO', 'DEBITO', 'CREDITO', 'DINHEIRO', 'OUTROS'));

-- Criar Conta Padrão para os lançamentos já existentes (opcional, evita erros na interface)
DO $$
DECLARE
    f_id UUID;
BEGIN
    FOR f_id IN SELECT id FROM perfil_fotografo LOOP
        -- Insere uma conta padrao "Conta Principal"
        INSERT INTO financeiro_contas (fotografo_id, nome, tipo)
        SELECT f_id, 'Conta Principal', 'CORRENTE'
        WHERE NOT EXISTS (
            SELECT 1 FROM financeiro_contas WHERE fotografo_id = f_id
        );
    END LOOP;
END $$;
