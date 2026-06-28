-- ============================================================
-- Migração 19: Transições Permitidas nas Etapas do CRM
-- ============================================================

-- Adiciona a coluna para armazenar os IDs das etapas de destino permitidas
ALTER TABLE etapas_pipeline 
ADD COLUMN IF NOT EXISTS transicoes_permitidas JSONB;

COMMENT ON COLUMN etapas_pipeline.transicoes_permitidas IS 'Array de UUIDs indicando para quais etapas um lead pode ser movido a partir desta. Se NULL, movimento livre.';
