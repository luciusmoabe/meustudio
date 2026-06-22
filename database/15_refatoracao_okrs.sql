-- ============================================================
-- MIGRATION: 15_refatoracao_okrs.sql
-- Épico 8: Módulo de Estratégia e OKRs (Ajustes de BPM)
-- Objetivo: Ajustar fórmulas de recálculo baseadas no novo Regime de Caixa,
-- adicionar snapshot de check-ins automáticos e novas automações.
-- ============================================================

-- 1. Nova Function para o Recálculo de OKRs
CREATE OR REPLACE FUNCTION recalculate_okrs_for_fotografo(p_fotografo_id UUID)
RETURNS void AS $$
DECLARE
    kr RECORD;
    v_new_val NUMERIC;
    v_total_leads INT;
    v_ganhos INT;
    v_receitas NUMERIC;
    v_despesas NUMERIC;
BEGIN
    -- Percorre todos os KRs automatizados deste fotógrafo
    FOR kr IN 
        SELECT k.id, k.tipo_automacao, o.data_inicio, o.data_fim, k.valor_atual 
        FROM okr_key_results k
        JOIN okr_objectives o ON k.objective_id = o.id
        WHERE o.fotografo_id = p_fotografo_id 
          AND k.tipo_automacao != 'manual'
    LOOP
        v_new_val := 0;

        -- NOVO REGIME DE CAIXA: Faturamento
        IF kr.tipo_automacao = 'faturamento_total' THEN
            SELECT COALESCE(SUM(valor_realizado), 0) INTO v_new_val
            FROM financeiro_lancamentos
            WHERE fotografo_id = p_fotografo_id 
              AND status = 'PAGO' 
              AND tipo = 'RECEITA'
              AND data_pagamento >= kr.data_inicio 
              AND data_pagamento <= kr.data_fim;

        -- NOVO TIPO: Redução de Despesas
        ELSIF kr.tipo_automacao = 'reducao_despesas' THEN
            SELECT COALESCE(SUM(valor_realizado), 0) INTO v_new_val
            FROM financeiro_lancamentos
            WHERE fotografo_id = p_fotografo_id 
              AND status = 'PAGO' 
              AND tipo = 'DESPESA'
              AND data_pagamento >= kr.data_inicio 
              AND data_pagamento <= kr.data_fim;

        -- NOVO TIPO: Lucro Líquido
        ELSIF kr.tipo_automacao = 'lucro_liquido' THEN
            SELECT COALESCE(SUM(valor_realizado), 0) INTO v_receitas
            FROM financeiro_lancamentos
            WHERE fotografo_id = p_fotografo_id AND status = 'PAGO' AND tipo = 'RECEITA'
              AND data_pagamento >= kr.data_inicio AND data_pagamento <= kr.data_fim;

            SELECT COALESCE(SUM(valor_realizado), 0) INTO v_despesas
            FROM financeiro_lancamentos
            WHERE fotografo_id = p_fotografo_id AND status = 'PAGO' AND tipo = 'DESPESA'
              AND data_pagamento >= kr.data_inicio AND data_pagamento <= kr.data_fim;

            v_new_val := v_receitas - v_despesas;

        -- Faturamento Extraordinário (Mantendo compatibilidade com pagamentos de portal)
        ELSIF kr.tipo_automacao = 'faturamento_extras' THEN
            SELECT COALESCE(SUM(fl.valor_realizado), 0) INTO v_new_val
            FROM financeiro_lancamentos fl
            LEFT JOIN pagamentos p ON fl.pagamento_id = p.id
            WHERE fl.fotografo_id = p_fotografo_id 
              AND fl.status = 'PAGO' 
              AND fl.tipo = 'RECEITA'
              AND p.tipo_cobranca = 'complemento'
              AND fl.data_pagamento >= kr.data_inicio 
              AND fl.data_pagamento <= kr.data_fim;

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
              AND status = 'aprovado'
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;

        ELSIF kr.tipo_automacao = 'taxa_conversao' THEN
            SELECT COUNT(*) INTO v_total_leads
            FROM leads_propostas
            WHERE fotografo_id = p_fotografo_id
              AND status IN ('aprovado', 'perdido')
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;
              
            SELECT COUNT(*) INTO v_ganhos
            FROM leads_propostas
            WHERE fotografo_id = p_fotografo_id
              AND status = 'aprovado'
              AND criado_em::date >= kr.data_inicio 
              AND criado_em::date <= kr.data_fim;

            IF v_total_leads > 0 THEN
                v_new_val := (v_ganhos::NUMERIC / v_total_leads::NUMERIC) * 100.0;
            ELSE
                v_new_val := 0;
            END IF;
        END IF;

        -- Se houver mudança, atualiza o KR e CRIA UM CHECK-IN AUTOMÁTICO PARA HISTÓRICO
        IF ROUND(kr.valor_atual, 2) != ROUND(v_new_val, 2) THEN
            
            -- Para não ativar o trigger do check_in em loop, fazemos direto o update no KR
            UPDATE okr_key_results
            SET valor_atual = ROUND(v_new_val, 2), updated_at = now()
            WHERE id = kr.id;

            -- Desabilita a trigger do checkin temporariamente para essa transacao para n dar loop de volta
            ALTER TABLE okr_checkins DISABLE TRIGGER trigger_update_kr_from_checkin;
            
            INSERT INTO okr_checkins (key_result_id, fotografo_id, valor_registrado, comentario)
            VALUES (kr.id, p_fotografo_id, ROUND(v_new_val, 2), 'Atualizado automaticamente pelo sistema.');
            
            ALTER TABLE okr_checkins ENABLE TRIGGER trigger_update_kr_from_checkin;

        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. Corrigir cálculo de progresso geral para não dar erro de divisão por zero e respeitar manutenção de meta
CREATE OR REPLACE FUNCTION update_objective_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_obj_id UUID;
    v_avg NUMERIC;
BEGIN
    v_obj_id := COALESCE(NEW.objective_id, OLD.objective_id);

    SELECT COALESCE(AVG(
        CASE
            -- Se a meta é igual ao valor inicial (Meta de manutenção, ex: Manter despesas em R$ 0)
            WHEN valor_meta = valor_inicial THEN
                CASE WHEN valor_atual = valor_meta THEN 100.0 ELSE 0.0 END
            
            -- Normal (maior é melhor)
            WHEN inverso = false THEN 
                LEAST(100.0, GREATEST(0.0, ((valor_atual - valor_inicial) / (valor_meta - valor_inicial)) * 100.0))
            
            -- Inverso (menor é melhor)
            ELSE 
                LEAST(100.0, GREATEST(0.0, ((valor_inicial - valor_atual) / (valor_inicial - valor_meta)) * 100.0))
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

-- 3. Trigger do Financeiro: agora escuta financeiro_lancamentos
DROP TRIGGER IF EXISTS tr_pagamentos_okr ON pagamentos;

CREATE OR REPLACE FUNCTION trigger_financeiro_okr() RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalculate_okrs_for_fotografo(COALESCE(NEW.fotografo_id, OLD.fotografo_id));
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_financeiro_okr ON financeiro_lancamentos;
CREATE TRIGGER tr_financeiro_okr
AFTER INSERT OR UPDATE OF status, valor_realizado
ON financeiro_lancamentos FOR EACH ROW EXECUTE FUNCTION trigger_financeiro_okr();

-- Recalcular retroativamente todos os OKRs da base
DO $$
DECLARE
    f_id UUID;
BEGIN
    FOR f_id IN SELECT DISTINCT id FROM perfil_fotografo LOOP
        PERFORM recalculate_okrs_for_fotografo(f_id);
    END LOOP;
END;
$$;
