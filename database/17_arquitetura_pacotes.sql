-- ============================================================
-- MeuStudio — Upgrade Arquitetural: Pacotes, Formulários e Jornadas
-- ============================================================

-- 1. Separar Serviço Simples de Pacote
ALTER TABLE tipos_sessao 
ADD COLUMN IF NOT EXISTS is_pacote BOOLEAN DEFAULT false;

-- 2. Tabela de Vinculação (O que o pacote inclui)
CREATE TABLE IF NOT EXISTS pacote_servicos (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    pacote_id       UUID            NOT NULL REFERENCES tipos_sessao(id) ON DELETE CASCADE,
    servico_id      UUID            NOT NULL REFERENCES tipos_sessao(id) ON DELETE RESTRICT,
    quantidade      INTEGER         NOT NULL DEFAULT 1,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    CONSTRAINT pacote_servicos_unico UNIQUE(pacote_id, servico_id)
);

ALTER TABLE pacote_servicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fotógrafo gerencia itens dos seus pacotes" ON pacote_servicos;
CREATE POLICY "Fotógrafo gerencia itens dos seus pacotes"
    ON pacote_servicos FOR ALL
    USING (pacote_id IN (SELECT id FROM tipos_sessao WHERE fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid())))
    WITH CHECK (pacote_id IN (SELECT id FROM tipos_sessao WHERE fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid())));


-- 3. Tabela de Formulários Dinâmicos por Pacote
CREATE TABLE IF NOT EXISTS servico_formularios (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipos_sessao_id UUID            NOT NULL REFERENCES tipos_sessao(id) ON DELETE CASCADE,
    pergunta        TEXT            NOT NULL,
    tipo_resposta   TEXT            NOT NULL DEFAULT 'texto' CHECK (tipo_resposta IN ('texto', 'numero', 'data', 'booleano')),
    obrigatorio     BOOLEAN         NOT NULL DEFAULT false,
    ordem           INTEGER         NOT NULL DEFAULT 0,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

ALTER TABLE servico_formularios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fotógrafo gerencia formulários dos seus pacotes" ON servico_formularios;
CREATE POLICY "Fotógrafo gerencia formulários dos seus pacotes"
    ON servico_formularios FOR ALL
    USING (tipos_sessao_id IN (SELECT id FROM tipos_sessao WHERE fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid())))
    WITH CHECK (tipos_sessao_id IN (SELECT id FROM tipos_sessao WHERE fotografo_id IN (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid())));


-- 4. Modificar etapas_pipeline para ser vinculada ao Pacote (opcional)
-- Se pacote_id for NULL, significa que é um pipeline "Padrão" do estúdio.
ALTER TABLE etapas_pipeline 
ADD COLUMN IF NOT EXISTS pacote_id UUID REFERENCES tipos_sessao(id) ON DELETE CASCADE;


-- 5. Atualizar Leads / Orçamentos para ter um Pacote Forte e Respostas JSON
-- Vamos manter a coluna "tipo_servico" por questões de legado (dados antigos).
ALTER TABLE leads_propostas 
ADD COLUMN IF NOT EXISTS pacote_id UUID REFERENCES tipos_sessao(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS respostas_formulario JSONB DEFAULT '{}'::jsonb;

-- Criar índices para otimizar buscas do CRM por Pacote
CREATE INDEX IF NOT EXISTS idx_leads_pacote ON leads_propostas(pacote_id);
