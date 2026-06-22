-- ============================================================
-- MIGRATION: 06_okrs.sql
-- Épico 8: Módulo de Estratégia e OKRs
-- ============================================================

-- ============================================================
-- TABELA 1: okr_objectives
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_objectives (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    titulo                  TEXT            NOT NULL,
    descricao               TEXT,
    trimestre               TEXT            NOT NULL, -- Ex: "Q3-2026"
    data_inicio             DATE            NOT NULL,
    data_fim                DATE            NOT NULL,
    progresso_geral         NUMERIC(5,2)    DEFAULT 0.00,
    created_at              TIMESTAMPTZ     DEFAULT now(),
    updated_at              TIMESTAMPTZ     DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE okr_objectives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo acessa apenas seus objetivos" ON okr_objectives;
CREATE POLICY "Fotógrafo acessa apenas seus objetivos"
    ON okr_objectives FOR ALL
    USING ( fotografo_id = (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()) );

-- ============================================================
-- TABELA 2: okr_key_results
-- ============================================================
CREATE TABLE IF NOT EXISTS okr_key_results (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    objective_id            UUID            NOT NULL REFERENCES okr_objectives(id) ON DELETE CASCADE,
    titulo                  TEXT            NOT NULL,
    valor_inicial           NUMERIC(10,2)   DEFAULT 0.00,
    valor_atual             NUMERIC(10,2)   DEFAULT 0.00,
    valor_meta              NUMERIC(10,2)   NOT NULL,
    unidade                 TEXT            DEFAULT 'un',
    tipo_automacao          TEXT            DEFAULT 'manual', -- 'manual', 'faturamento_total', 'faturamento_extras', 'ensaios_entregues', 'leads_ganhos', 'taxa_conversao'
    inverso                 BOOLEAN         DEFAULT false, -- se true, quanto menor, melhor
    created_at              TIMESTAMPTZ     DEFAULT now(),
    updated_at              TIMESTAMPTZ     DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE okr_key_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo acessa apenas seus KRs" ON okr_key_results;
CREATE POLICY "Fotógrafo acessa apenas seus KRs"
    ON okr_key_results FOR ALL
    USING ( 
        objective_id IN (
            SELECT id FROM okr_objectives WHERE fotografo_id = (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid())
        ) 
    );

-- ============================================================
-- TRIGGER: Atualizar progresso do Objetivo pai ao mexer nos KRs
-- ============================================================
CREATE OR REPLACE FUNCTION update_objective_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_obj_id UUID;
    v_avg NUMERIC;
BEGIN
    v_obj_id := COALESCE(NEW.objective_id, OLD.objective_id);

    SELECT COALESCE(AVG(
        CASE
            WHEN inverso = false THEN LEAST(100.0, GREATEST(0.0, ((valor_atual - valor_inicial) / NULLIF(valor_meta - valor_inicial, 0)) * 100.0))
            ELSE LEAST(100.0, GREATEST(0.0, ((valor_inicial - valor_atual) / NULLIF(valor_inicial - valor_meta, 0)) * 100.0))
        END
    ), 0) INTO v_avg
    FROM okr_key_results
    WHERE objective_id = v_obj_id;

    UPDATE okr_objectives
    SET progresso_geral = ROUND(v_avg, 2), updated_at = now()
    WHERE id = v_obj_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_objective_progress
AFTER INSERT OR UPDATE OF valor_atual, valor_meta, valor_inicial
ON okr_key_results
FOR EACH ROW
EXECUTE FUNCTION update_objective_progress();

CREATE TRIGGER trigger_update_objective_progress_del
AFTER DELETE
ON okr_key_results
FOR EACH ROW
EXECUTE FUNCTION update_objective_progress();


-- ============================================================
-- FUNCTION: Recalcular todos os KRs automatizados de um fotógrafo
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_okrs_for_fotografo(p_fotografo_id UUID)
RETURNS void AS $$
DECLARE
    kr RECORD;
    v_new_val NUMERIC;
    v_total_leads INT;
    v_ganhos INT;
BEGIN
    -- Percorre todos os KRs automatizados deste fotógrafo
    FOR kr IN 
        SELECT kr.id, kr.tipo_automacao, o.data_inicio, o.data_fim 
        FROM okr_key_results kr
        JOIN okr_objectives o ON kr.objective_id = o.id
        WHERE o.fotografo_id = p_fotografo_id 
          AND kr.tipo_automacao != 'manual'
    LOOP
        v_new_val := 0;

        IF kr.tipo_automacao = 'faturamento_total' THEN
            SELECT COALESCE(SUM(valor_bruto), 0) INTO v_new_val
            FROM pagamentos
            WHERE fotografo_id = p_fotografo_id 
              AND status = 'pago' 
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;

        ELSIF kr.tipo_automacao = 'faturamento_extras' THEN
            SELECT COALESCE(SUM(valor_bruto), 0) INTO v_new_val
            FROM pagamentos
            WHERE fotografo_id = p_fotografo_id 
              AND status = 'pago' 
              AND tipo_cobranca = 'complemento'
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;

        ELSIF kr.tipo_automacao = 'ensaios_entregues' THEN
            SELECT COUNT(*) INTO v_new_val
            FROM sessoes_agenda
            WHERE fotografo_id = p_fotografo_id
              AND status = 'entregue'
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;

        ELSIF kr.tipo_automacao = 'leads_ganhos' THEN
            SELECT COUNT(*) INTO v_new_val
            FROM leads_propostas
            WHERE fotografo_id = p_fotografo_id
              AND status = 'ganhou'
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;

        ELSIF kr.tipo_automacao = 'taxa_conversao' THEN
            SELECT COUNT(*) INTO v_total_leads
            FROM leads_propostas
            WHERE fotografo_id = p_fotografo_id
              AND status IN ('ganhou', 'perdeu')
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;
              
            SELECT COUNT(*) INTO v_ganhos
            FROM leads_propostas
            WHERE fotografo_id = p_fotografo_id
              AND status = 'ganhou'
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;

            IF v_total_leads > 0 THEN
                v_new_val := (v_ganhos::NUMERIC / v_total_leads::NUMERIC) * 100.0;
            ELSE
                v_new_val := 0;
            END IF;
        END IF;

        -- Atualiza o KR apenas se o valor mudou para evitar triggers em loop
        UPDATE okr_key_results
        SET valor_atual = ROUND(v_new_val, 2), updated_at = now()
        WHERE id = kr.id AND valor_atual != ROUND(v_new_val, 2);

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS PARA INVOCAR O RECALCULO
-- ============================================================

-- 1. Ao alterar Pagamentos (Faturamento)
CREATE OR REPLACE FUNCTION trigger_pagamentos_okr() RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalculate_okrs_for_fotografo(COALESCE(NEW.fotografo_id, OLD.fotografo_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_pagamentos_okr
AFTER INSERT OR UPDATE OF status, valor_bruto
ON pagamentos FOR EACH ROW EXECUTE FUNCTION trigger_pagamentos_okr();

-- 2. Ao alterar Sessoes (Produtividade)
CREATE OR REPLACE FUNCTION trigger_sessoes_okr() RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalculate_okrs_for_fotografo(COALESCE(NEW.fotografo_id, OLD.fotografo_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sessoes_okr
AFTER INSERT OR UPDATE OF status
ON sessoes_agenda FOR EACH ROW EXECUTE FUNCTION trigger_sessoes_okr();

-- 3. Ao alterar Leads (Conversão)
CREATE OR REPLACE FUNCTION trigger_leads_okr() RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalculate_okrs_for_fotografo(COALESCE(NEW.fotografo_id, OLD.fotografo_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_leads_okr
AFTER INSERT OR UPDATE OF status
ON leads_propostas FOR EACH ROW EXECUTE FUNCTION trigger_leads_okr();
