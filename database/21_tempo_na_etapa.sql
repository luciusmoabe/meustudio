-- ============================================================
-- Migração: Tempo na Etapa (Days in Stage)
-- Tabelas afetadas: leads_propostas, sessoes_agenda
-- ============================================================

-- 1. Adicionar colunas
ALTER TABLE leads_propostas 
ADD COLUMN IF NOT EXISTS data_entrada_etapa TIMESTAMPTZ DEFAULT now();

ALTER TABLE sessoes_agenda 
ADD COLUMN IF NOT EXISTS data_entrada_etapa TIMESTAMPTZ DEFAULT now();

-- 2. Preencher legado (usando criado_em como fallback ou now() se preferir, 
-- mas criado_em faz mais sentido para leads antigos que nunca se moveram)
UPDATE leads_propostas 
SET data_entrada_etapa = criado_em 
WHERE data_entrada_etapa IS NULL;

UPDATE sessoes_agenda 
SET data_entrada_etapa = criado_em 
WHERE data_entrada_etapa IS NULL;

-- 3. Função Trigger para atualizar data_entrada_etapa automaticamente
CREATE OR REPLACE FUNCTION update_data_entrada_etapa()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for tabela de leads
    IF TG_TABLE_NAME = 'leads_propostas' THEN
        IF OLD.etapa_pipeline_id IS DISTINCT FROM NEW.etapa_pipeline_id THEN
            NEW.data_entrada_etapa = now();
        END IF;
    -- Se for tabela de sessoes
    ELSIF TG_TABLE_NAME = 'sessoes_agenda' THEN
        IF OLD.etapa_producao_id IS DISTINCT FROM NEW.etapa_producao_id THEN
            NEW.data_entrada_etapa = now();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Anexar triggers (remover antes se existirem para idempotência)
DROP TRIGGER IF EXISTS trg_leads_entrada_etapa ON leads_propostas;
CREATE TRIGGER trg_leads_entrada_etapa
BEFORE UPDATE ON leads_propostas
FOR EACH ROW EXECUTE FUNCTION update_data_entrada_etapa();

DROP TRIGGER IF EXISTS trg_sessoes_entrada_etapa ON sessoes_agenda;
CREATE TRIGGER trg_sessoes_entrada_etapa
BEFORE UPDATE ON sessoes_agenda
FOR EACH ROW EXECUTE FUNCTION update_data_entrada_etapa();
