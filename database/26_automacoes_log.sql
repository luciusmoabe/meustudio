-- ============================================================
-- MeuStudio — Motor de Automações (Fase 3)
-- ============================================================

CREATE TYPE tipo_automacao AS ENUM (
    'follow_up_proposta',
    'lembrete_sessao',
    'cobranca_pendente'
);

CREATE TABLE IF NOT EXISTS automacoes_log (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id    UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    
    tipo_automacao  tipo_automacao  NOT NULL,
    referencia_id   UUID            NOT NULL, -- ID do Lead ou ID da Sessão, dependendo do tipo
    
    disparado_em    TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Constraints para evitar duplo disparo acidental
    CONSTRAINT unq_automacao_ref UNIQUE (tipo_automacao, referencia_id)
);

-- Habilitar RLS
ALTER TABLE automacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fotógrafo vê seus próprios logs de automação"
    ON automacoes_log FOR ALL
    USING (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()))
    WITH CHECK (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()));

-- Índices de performance para a CRON (busca rápida se já foi disparado)
CREATE INDEX idx_automacoes_ref ON automacoes_log(referencia_id, tipo_automacao);
