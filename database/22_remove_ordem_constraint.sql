-- ============================================================
-- Migração: Remover Constraint de Ordem Única das Etapas
-- Tabelas afetadas: etapas_pipeline
-- ============================================================

-- Remove a restrição UNIQUE(fotografo_id, tipo_pipeline, ordem)
-- Isso permite atualizar a ordem das etapas livremente (drag and drop)
ALTER TABLE etapas_pipeline 
DROP CONSTRAINT IF EXISTS etapas_pipeline_ordem_unica;
