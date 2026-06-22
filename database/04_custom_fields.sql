-- ============================================================
-- MeuStudio — Customização de Pipelines e Tipos de Sessão
-- ============================================================

-- 1. Criar tabela para tipos de sessão customizados
CREATE TABLE IF NOT EXISTS tipos_sessao (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id    UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    nome            TEXT            NOT NULL,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT tipos_sessao_nome_unico UNIQUE (fotografo_id, nome)
);

-- 2. Habilitar RLS e criar policy
ALTER TABLE tipos_sessao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo gerencia seus tipos de sessão" ON tipos_sessao;
CREATE POLICY "Fotógrafo gerencia seus tipos de sessão"
    ON tipos_sessao FOR ALL
    USING (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()))
    WITH CHECK (fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()));

-- 3. Alterar tipos das colunas existentes para TEXT
ALTER TABLE modelos_contrato ALTER COLUMN tipo_sessao TYPE TEXT;
ALTER TABLE modelos_contrato ALTER COLUMN tipo_sessao SET DEFAULT 'outros';

ALTER TABLE leads_propostas ALTER COLUMN tipo_servico TYPE TEXT;
ALTER TABLE leads_propostas ALTER COLUMN tipo_servico SET DEFAULT 'outros';

ALTER TABLE sessoes_agenda ALTER COLUMN tipo_sessao TYPE TEXT;
ALTER TABLE sessoes_agenda ALTER COLUMN tipo_sessao SET DEFAULT 'outros';
