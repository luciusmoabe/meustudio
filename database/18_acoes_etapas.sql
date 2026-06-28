-- ============================================================
-- Migração 18: Tarefas e Ações nas Etapas do CRM
-- ============================================================

-- 1. Adicionar meta_acoes na configuração da etapa
ALTER TABLE etapas_pipeline 
ADD COLUMN IF NOT EXISTS meta_acoes INTEGER DEFAULT 0;

COMMENT ON COLUMN etapas_pipeline.meta_acoes IS 'Quantidade esperada de ações/tarefas para esta etapa (ex: 4 follow ups). 0 significa que não tem meta.';

-- 2. Adicionar o histórico de ações no Lead
ALTER TABLE leads_propostas 
ADD COLUMN IF NOT EXISTS historico_acoes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN leads_propostas.historico_acoes IS 'Registro de ações realizadas no lead. Formato: [{ titulo: "Follow up 1", data: "2023-10-25T12:00:00Z", etapa_id: "uuid" }]';
