-- ============================================================
-- MeuStudio — Épico 12: Unificação Financeira (Opção B)
-- Objetivo: financeiro_lancamentos como fonte única de verdade
-- Garante que pagamentos de contratos apareçam no módulo
-- financeiro sem duplicação manual.
-- ============================================================

-- ============================================================
-- 1. ENRIQUECER financeiro_lancamentos com metadados de origem
-- ============================================================
ALTER TABLE financeiro_lancamentos
ADD COLUMN IF NOT EXISTS origem        TEXT DEFAULT 'manual'
    CHECK (origem IN ('manual', 'contrato', 'portal')),
ADD COLUMN IF NOT EXISTS pagamento_id  UUID REFERENCES pagamentos(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS lead_id       UUID REFERENCES leads_propostas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fin_lanc_origem     ON financeiro_lancamentos(fotografo_id, origem);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_pagamento  ON financeiro_lancamentos(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_fin_lanc_lead       ON financeiro_lancamentos(lead_id);

-- ============================================================
-- 2. MIGRAR DADOS HISTÓRICOS: parcelas → financeiro_lancamentos
-- Transforma cada parcela de contrato em um lançamento de RECEITA.
-- Somente insere se ainda não existe (idempotente).
-- ============================================================
INSERT INTO financeiro_lancamentos (
    fotografo_id, tipo, natureza, descricao,
    valor_previsto, valor_realizado,
    data_vencimento, data_pagamento,
    status, origem, lead_id,
    conta_id, forma_pagamento
)
SELECT
    p.fotografo_id,
    'RECEITA',
    'VARIAVEL',
    COALESCE(
        'Parcela ' || p.numero_parcela || ' — ' || c.nome,
        'Parcela ' || p.numero_parcela
    ) AS descricao,
    p.valor                        AS valor_previsto,
    CASE WHEN p.status = 'pago' THEN p.valor ELSE NULL END AS valor_realizado,
    p.data_vencimento::DATE        AS data_vencimento,
    CASE WHEN p.status = 'pago' THEN p.cobrada_em::DATE ELSE NULL END AS data_pagamento,
    CASE
        WHEN p.status = 'pago'   THEN 'PAGO'
        WHEN p.data_vencimento < CURRENT_DATE AND p.status != 'pago' THEN 'ATRASADO'
        ELSE 'PENDENTE'
    END                            AS status,
    'contrato'                     AS origem,
    p.lead_id                      AS lead_id,
    p.conta_id,
    UPPER(p.forma_pagamento)       AS forma_pagamento
FROM parcelas p
LEFT JOIN leads_propostas lp ON lp.id = p.lead_id
LEFT JOIN clientes c ON c.id = lp.cliente_id
WHERE NOT EXISTS (
    SELECT 1 FROM financeiro_lancamentos fl
    WHERE fl.origem = 'contrato'
      AND fl.lead_id = p.lead_id
      AND fl.descricao LIKE 'Parcela ' || p.numero_parcela || '%'
      AND fl.fotografo_id = p.fotografo_id
);

-- ============================================================
-- 3. MIGRAR PAGAMENTOS DO PORTAL → financeiro_lancamentos
-- Pagamentos de sinal/extras confirmados no Portal do Cliente.
-- ============================================================
INSERT INTO financeiro_lancamentos (
    fotografo_id, tipo, natureza, descricao,
    valor_previsto, valor_realizado,
    data_vencimento, data_pagamento,
    status, origem, pagamento_id, lead_id,
    forma_pagamento
)
SELECT
    pg.fotografo_id,
    'RECEITA',
    'VARIAVEL',
    COALESCE(pg.descricao, 'Pagamento — ' || lp.nome_cliente) AS descricao,
    pg.valor_bruto                  AS valor_previsto,
    CASE WHEN pg.status = 'pago' THEN pg.valor_bruto ELSE NULL END AS valor_realizado,
    COALESCE(pg.pago_em::DATE, CURRENT_DATE) AS data_vencimento,
    CASE WHEN pg.status = 'pago' THEN pg.pago_em::DATE ELSE NULL END AS data_pagamento,
    CASE
        WHEN pg.status = 'pago'                THEN 'PAGO'
        WHEN pg.status IN ('falhou','estornado') THEN 'CANCELADO'
        ELSE 'PENDENTE'
    END                             AS status,
    'portal'                        AS origem,
    pg.id                           AS pagamento_id,
    pg.lead_id,
    CASE pg.meio_pagamento
        WHEN 'pix'            THEN 'PIX'
        WHEN 'cartao_credito' THEN 'CREDITO'
        WHEN 'boleto'         THEN 'BOLETO'
        ELSE 'OUTROS'
    END                             AS forma_pagamento
FROM pagamentos pg
LEFT JOIN leads_propostas lp ON lp.id = pg.lead_id
WHERE NOT EXISTS (
    SELECT 1 FROM financeiro_lancamentos fl
    WHERE fl.pagamento_id = pg.id
);

-- ============================================================
-- 4. TRIGGER: Novo pagamento confirmado → cria lançamento
-- Ao inserir ou atualizar um pagamento para status='pago',
-- automaticamente cria (ou atualiza) o lançamento em financeiro.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_pagamento_para_lancamento()
RETURNS TRIGGER AS $$
DECLARE
    v_descricao TEXT;
    v_cliente   TEXT;
    v_forma     TEXT;
BEGIN
    -- Só age quando status muda para 'pago'
    IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN

        -- Busca nome do cliente
        SELECT lp.nome_cliente INTO v_cliente
        FROM leads_propostas lp WHERE lp.id = NEW.lead_id;

        v_descricao := COALESCE(NEW.descricao, 'Pagamento — ' || COALESCE(v_cliente, 'Cliente'));

        -- Converte meio de pagamento
        v_forma := CASE NEW.meio_pagamento
            WHEN 'pix'            THEN 'PIX'
            WHEN 'cartao_credito' THEN 'CREDITO'
            WHEN 'boleto'         THEN 'BOLETO'
            ELSE 'OUTROS'
        END;

        -- Verifica se já existe (portal)
        IF EXISTS (SELECT 1 FROM financeiro_lancamentos WHERE pagamento_id = NEW.id) THEN
            -- Atualiza o lançamento existente
            UPDATE financeiro_lancamentos SET
                status          = 'PAGO',
                valor_realizado = NEW.valor_bruto,
                data_pagamento  = COALESCE(NEW.pago_em::DATE, CURRENT_DATE),
                forma_pagamento = v_forma
            WHERE pagamento_id = NEW.id;
        ELSE
            -- Cria novo lançamento
            INSERT INTO financeiro_lancamentos (
                fotografo_id, tipo, natureza, descricao,
                valor_previsto, valor_realizado,
                data_vencimento, data_pagamento,
                status, origem, pagamento_id, lead_id,
                forma_pagamento
            ) VALUES (
                NEW.fotografo_id,
                'RECEITA',
                'VARIAVEL',
                v_descricao,
                NEW.valor_bruto,
                NEW.valor_bruto,
                COALESCE(NEW.pago_em::DATE, CURRENT_DATE),
                COALESCE(NEW.pago_em::DATE, CURRENT_DATE),
                'PAGO',
                'portal',
                NEW.id,
                NEW.lead_id,
                v_forma
            );
        END IF;

    -- Quando estornado/cancelado → atualiza o lançamento
    ELSIF NEW.status IN ('estornado', 'falhou') AND OLD.status = 'pago' THEN
        UPDATE financeiro_lancamentos SET
            status = 'CANCELADO'
        WHERE pagamento_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger na tabela pagamentos
DROP TRIGGER IF EXISTS trg_pagamento_para_lancamento ON pagamentos;
CREATE TRIGGER trg_pagamento_para_lancamento
    AFTER INSERT OR UPDATE OF status ON pagamentos
    FOR EACH ROW
    EXECUTE FUNCTION fn_pagamento_para_lancamento();

-- ============================================================
-- 5. TRIGGER: Dar baixa em parcela → atualiza lancamento
-- ============================================================
CREATE OR REPLACE FUNCTION fn_parcela_para_lancamento()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') THEN
        -- Tenta atualizar lançamento existente vinculado ao lead/parcela
        UPDATE financeiro_lancamentos SET
            status          = 'PAGO',
            valor_realizado = NEW.valor,
            data_pagamento  = COALESCE(NEW.cobrada_em::DATE, CURRENT_DATE),
            conta_id        = COALESCE(NEW.conta_id, conta_id),
            forma_pagamento = COALESCE(UPPER(NEW.forma_pagamento), forma_pagamento)
        WHERE origem = 'contrato'
          AND lead_id = NEW.lead_id
          AND fotografo_id = NEW.fotografo_id
          AND descricao LIKE 'Parcela ' || NEW.numero_parcela || '%'
          AND status != 'PAGO';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parcela_para_lancamento ON parcelas;
CREATE TRIGGER trg_parcela_para_lancamento
    AFTER INSERT OR UPDATE OF status ON parcelas
    FOR EACH ROW
    EXECUTE FUNCTION fn_parcela_para_lancamento();
