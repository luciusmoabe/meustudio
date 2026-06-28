-- ============================================================
-- Migração 23: Correção de transicoes_permitidas (números → UUIDs)
-- ============================================================

-- 1. Limpar transicoes_permitidas que contenham números (formato antigo)
-- Detecta arrays que têm itens numéricos em vez de UUIDs
UPDATE etapas_pipeline 
SET transicoes_permitidas = NULL 
WHERE transicoes_permitidas IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(transicoes_permitidas) elem
    WHERE jsonb_typeof(elem) = 'number'
  );

-- 2. Trigger de validação server-side para transições de etapas
-- Impede que um lead seja movido para uma etapa não permitida
CREATE OR REPLACE FUNCTION validar_transicao_etapa()
RETURNS TRIGGER AS $$
DECLARE
    regras JSONB;
    destino_id UUID;
BEGIN
    -- Só valida se etapa_pipeline_id está mudando
    IF OLD.etapa_pipeline_id IS NOT DISTINCT FROM NEW.etapa_pipeline_id THEN
        RETURN NEW;
    END IF;

    -- Se vindo de NULL (lead novo), permite qualquer destino
    IF OLD.etapa_pipeline_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Busca as regras de transição da etapa de origem
    SELECT ep.transicoes_permitidas INTO regras
    FROM etapas_pipeline ep
    WHERE ep.id = OLD.etapa_pipeline_id;

    -- Se não há regras definidas (NULL ou array vazio), movimento livre
    IF regras IS NULL OR jsonb_array_length(regras) = 0 THEN
        RETURN NEW;
    END IF;

    -- Verifica se o destino está na lista de transições permitidas
    destino_id := NEW.etapa_pipeline_id;
    IF NOT regras @> to_jsonb(destino_id::text) THEN
        RAISE EXCEPTION 'Transição não permitida: a etapa de origem não permite mover para esta etapa de destino.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Anexar trigger (idempotente)
DROP TRIGGER IF EXISTS trg_validar_transicao_leads ON leads_propostas;
CREATE TRIGGER trg_validar_transicao_leads
BEFORE UPDATE ON leads_propostas
FOR EACH ROW EXECUTE FUNCTION validar_transicao_etapa();

-- Comentário
COMMENT ON FUNCTION validar_transicao_etapa() IS 'Valida no server-side que a movimentação de um lead entre etapas respeita as transicoes_permitidas configuradas na etapa de origem. Se NULL, permite livre movimentação.';
