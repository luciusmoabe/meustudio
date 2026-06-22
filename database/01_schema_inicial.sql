-- ============================================================
--  MeuStudio SaaS — Esquema Inicial do Banco de Dados
--  Plataforma: Supabase (PostgreSQL)
--  Versão: 1.0  |  Autor: Engenharia de Dados
--  PRD: v2.0 — AI-First Deployment
-- ============================================================

-- ============================================================
-- EXTENSÕES NECESSÁRIAS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES (idempotente: ignora se já existir)
-- ============================================================

-- Status do lead dentro do funil comercial
DO $$ BEGIN
    CREATE TYPE status_lead AS ENUM (
        'novo',
        'em_negociacao',
        'proposta_enviada',
        'aprovado',
        'confirmado',
        'perdido',
        'arquivado'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Motivo de perda do lead (RF07 — Cenário Perdeu)
DO $$ BEGIN
    CREATE TYPE motivo_perda AS ENUM (
        'preco',
        'falta_de_data',
        'escolheu_concorrente',
        'sumiu',
        'outro'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipos de nicho/sessão suportados
DO $$ BEGIN
    CREATE TYPE tipo_sessao AS ENUM (
        'newborn',
        'casamento',
        'corporativo',
        'maternidade',
        'familia',
        'gestante',
        'ensaio_externo',
        'evento',
        'outros'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABELA 1: perfil_fotografo
-- RF01 — Cadastro de Dados Institucionais
-- Âncora multi-tenant: cada linha representa um estúdio/fotógrafo
-- ============================================================
CREATE TABLE IF NOT EXISTS perfil_fotografo (
    -- Identidade
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id                 UUID            NOT NULL UNIQUE,   -- FK para auth.users (Supabase Auth)

    -- Dados Comerciais (RF01)
    nome_comercial          TEXT            NOT NULL,
    nome_responsavel        TEXT,
    cpf_cnpj                TEXT            NOT NULL,
    whatsapp                TEXT,
    email_comercial         TEXT,

    -- Endereço
    logradouro              TEXT,
    numero                  TEXT,
    complemento             TEXT,
    bairro                  TEXT,
    cidade                  TEXT,
    estado                  CHAR(2),
    cep                     TEXT,

    -- Dados Financeiros (usado nos contratos via template)
    chave_pix               TEXT,
    banco                   TEXT,

    -- Identidade Visual do Estúdio
    logo_url                TEXT,           -- URL do logo no Supabase Storage
    cor_primaria            TEXT DEFAULT '#6366f1',
    cor_secundaria          TEXT DEFAULT '#a78bfa',

    -- Integração Google Calendar (RF02)
    google_calendar_token   JSONB,          -- Armazena os tokens OAuth de forma segura
    google_calendar_id      TEXT,
    google_connected_at     TIMESTAMPTZ,

    -- Configurações Gerais
    fuso_horario            TEXT DEFAULT 'America/Sao_Paulo',
    moeda                   TEXT DEFAULT 'BRL',

    -- Auditoria
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT perfil_cpf_cnpj_check CHECK (LENGTH(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', '')) IN (11, 14))
);

COMMENT ON TABLE perfil_fotografo IS 'Âncora multi-tenant. Cada linha representa um estúdio/fotógrafo cadastrado na plataforma.';
COMMENT ON COLUMN perfil_fotografo.user_id IS 'Referência ao usuário autenticado via Supabase Auth (auth.users).';
COMMENT ON COLUMN perfil_fotografo.google_calendar_token IS 'JSON com access_token, refresh_token e expiry do OAuth Google. Deve ser criptografado em nível de aplicação.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_perfil_fotografo_user_id ON perfil_fotografo(user_id);


-- ============================================================
-- TABELA 2: modelos_contrato
-- RF03 — Biblioteca de Contratos por Tipo de Sessão
-- RF04 — Motor de Injeção de Variáveis
-- ============================================================
CREATE TABLE IF NOT EXISTS modelos_contrato (
    -- Identidade
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy: cada template pertence a um fotógrafo
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,

    -- Classificação
    nome_template           TEXT            NOT NULL,           -- Ex: "Contrato Newborn Premium"
    tipo_sessao             tipo_sessao     NOT NULL DEFAULT 'outros',
    descricao               TEXT,                               -- Uso interno, não aparece no contrato

    -- Conteúdo do Contrato (RF03 e RF04)
    -- Suporta tags: {{nome_cliente}}, {{valor_total}}, {{cnpj_fotografo}}, {{pix_estudio}}, etc.
    minuta_html             TEXT            NOT NULL,           -- Corpo do contrato com tags dinâmicas
    clausulas_extras        TEXT,                               -- Cláusulas opcionais adicionáveis

    -- Parâmetros Financeiros Default do Template
    valor_base              NUMERIC(10,2),                      -- Valor padrão do pacote
    percentual_sinal        NUMERIC(5,2) DEFAULT 30.00,         -- % de entrada exigida (RF10)
    limite_fotos_contrato   INTEGER,                            -- Teto de fotos (RF18)

    -- Metadata
    ativo                   BOOLEAN         NOT NULL DEFAULT TRUE,
    versao                  INTEGER         NOT NULL DEFAULT 1,

    -- Auditoria
    criado_em               TIMESTAMPTZ     NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE modelos_contrato IS 'Biblioteca de minutas de contrato por nicho. Suporta variáveis dinâmicas via tags {{nome_campo}}.';
COMMENT ON COLUMN modelos_contrato.minuta_html IS 'Corpo do contrato em HTML. Tags suportadas: {{nome_cliente}}, {{email_cliente}}, {{valor_total}}, {{valor_sinal}}, {{data_sessao}}, {{cnpj_fotografo}}, {{nome_comercial}}, {{pix_estudio}}, {{local_sessao}}, {{limite_fotos}}.';
COMMENT ON COLUMN modelos_contrato.percentual_sinal IS 'Percentual do valor total exigido como sinal no checkout (RF10). Default: 30%.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_modelos_contrato_fotografo_id ON modelos_contrato(fotografo_id);
CREATE INDEX IF NOT EXISTS idx_modelos_contrato_tipo_sessao  ON modelos_contrato(fotografo_id, tipo_sessao);


-- ============================================================
-- TABELA 3: etapas_pipeline
-- RF06 — Pipelines de Vendas Dinâmicos
-- ============================================================
CREATE TABLE IF NOT EXISTS etapas_pipeline (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,

    nome_etapa              TEXT            NOT NULL,           -- Ex: "Reunião Agendada"
    ordem                   INTEGER         NOT NULL,           -- Posição da coluna no Kanban
    cor_hex                 TEXT DEFAULT '#6366f1',
    tipo_pipeline           TEXT NOT NULL DEFAULT 'vendas'      -- 'vendas' ou 'producao' (RF14)
        CHECK (tipo_pipeline IN ('vendas', 'producao')),

    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT etapas_pipeline_ordem_unica UNIQUE (fotografo_id, tipo_pipeline, ordem)
);

COMMENT ON TABLE etapas_pipeline IS 'Colunas dinâmicas do Kanban de vendas (RF06) e produção (RF14), configuráveis por fotógrafo.';


-- ============================================================
-- TABELA 4: leads_propostas
-- RF05 — Captura Inicial de Leads
-- RF06 — Pipeline de Vendas
-- RF07 — Bifurcação de Desfecho Comercial (Ganhou/Perdeu)
-- RF08 — Suporte a Combos/Pacotes
-- RF09 — Link Mágico do Cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS leads_propostas (
    -- Identidade
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,

    -- Dados do Cliente (RF05)
    nome_cliente            TEXT            NOT NULL,
    whatsapp_cliente        TEXT,
    email_cliente           TEXT,

    -- Classificação Comercial (RF05)
    tipo_servico            tipo_sessao     NOT NULL DEFAULT 'outros',
    data_pretendida         DATE,
    valor_estimado          NUMERIC(10,2),

    -- Funil de Vendas (RF06)
    etapa_pipeline_id       UUID            REFERENCES etapas_pipeline(id) ON DELETE SET NULL,
    status                  status_lead     NOT NULL DEFAULT 'novo',
    origem_lead             TEXT,           -- Ex: Instagram, Indicação, Google

    -- Desfecho Comercial (RF07)
    -- Cenário GANHOU
    data_aprovacao          TIMESTAMPTZ,
    modelo_contrato_id      UUID            REFERENCES modelos_contrato(id) ON DELETE SET NULL,
    valor_total_contratado  NUMERIC(10,2),
    valor_sinal             NUMERIC(10,2),

    -- Link Mágico do Cliente (RF09)
    link_magico_token       TEXT            UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    link_magico_expira_em   TIMESTAMPTZ,    -- NULL = não expira após confirmação

    -- Cenário PERDEU (RF07)
    data_perda              TIMESTAMPTZ,
    motivo_perda            motivo_perda,
    observacao_perda        TEXT,           -- Notas internas sobre a perda

    -- Dados do Contrato Gerado
    contrato_html_gerado    TEXT,           -- HTML final após injeção de variáveis (RF04)
    contrato_assinado_url   TEXT,           -- URL do PDF assinado no Storage

    -- Auditoria
    criado_em               TIMESTAMPTZ     NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraints de Integridade de Negócio
    CONSTRAINT chk_status_perda CHECK (
        (status = 'perdido' AND motivo_perda IS NOT NULL) OR
        (status <> 'perdido')
    ),
    CONSTRAINT chk_status_aprovado CHECK (
        (status IN ('aprovado', 'confirmado') AND modelo_contrato_id IS NOT NULL) OR
        (status NOT IN ('aprovado', 'confirmado'))
    )
);

COMMENT ON TABLE leads_propostas IS 'Registro central do CRM. Capta leads (RF05), gerencia o funil (RF06), bifurca desfechos Ganhou/Perdeu (RF07) e é o pai de todas as sessões do pacote (RF08).';
COMMENT ON COLUMN leads_propostas.link_magico_token IS 'Token único e seguro gerado por gen_random_bytes. Compõe a URL do Portal do Cliente: /cliente/{token} (RF09).';
COMMENT ON COLUMN leads_propostas.etapa_pipeline_id IS 'Coluna atual do lead no Kanban de Vendas dinâmico (RF06).';
COMMENT ON COLUMN leads_propostas.contrato_html_gerado IS 'Snapshot do HTML do contrato após substituição das variáveis dinâmicas (RF04). Preserva o estado no momento da aprovação.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_leads_fotografo_id     ON leads_propostas(fotografo_id);
CREATE INDEX IF NOT EXISTS idx_leads_status           ON leads_propostas(fotografo_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_link_magico      ON leads_propostas(link_magico_token);
CREATE INDEX IF NOT EXISTS idx_leads_data_pretendida  ON leads_propostas(fotografo_id, data_pretendida);
CREATE INDEX IF NOT EXISTS idx_leads_tipo_servico     ON leads_propostas(fotografo_id, tipo_servico);


-- ============================================================
-- TRIGGERS: atualizar campo atualizado_em automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_perfil_fotografo ON perfil_fotografo;
CREATE TRIGGER set_timestamp_perfil_fotografo
    BEFORE UPDATE ON perfil_fotografo
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_modelos_contrato ON modelos_contrato;
CREATE TRIGGER set_timestamp_modelos_contrato
    BEFORE UPDATE ON modelos_contrato
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_leads_propostas ON leads_propostas;
CREATE TRIGGER set_timestamp_leads_propostas
    BEFORE UPDATE ON leads_propostas
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Multi-Tenancy
-- Garante que cada fotógrafo acesse APENAS seus próprios dados
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE perfil_fotografo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_contrato   ENABLE ROW LEVEL SECURITY;
ALTER TABLE etapas_pipeline    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads_propostas    ENABLE ROW LEVEL SECURITY;

-- Policies: perfil_fotografo
DROP POLICY IF EXISTS "Fotógrafo vê seu próprio perfil"   ON perfil_fotografo;
DROP POLICY IF EXISTS "Fotógrafo insere seu próprio perfil" ON perfil_fotografo;
DROP POLICY IF EXISTS "Fotógrafo atualiza seu próprio perfil" ON perfil_fotografo;

CREATE POLICY "Fotógrafo vê seu próprio perfil"
    ON perfil_fotografo FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Fotógrafo insere seu próprio perfil"
    ON perfil_fotografo FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Fotógrafo atualiza seu próprio perfil"
    ON perfil_fotografo FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies: modelos_contrato (acesso via fotografo_id)
DROP POLICY IF EXISTS "Fotógrafo vê seus próprios modelos" ON modelos_contrato;

CREATE POLICY "Fotógrafo vê seus próprios modelos"
    ON modelos_contrato FOR ALL
    USING (
        fotografo_id IN (
            SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
        )
    );

-- Policies: etapas_pipeline
DROP POLICY IF EXISTS "Fotógrafo vê seus próprios pipelines" ON etapas_pipeline;

CREATE POLICY "Fotógrafo vê seus próprios pipelines"
    ON etapas_pipeline FOR ALL
    USING (
        fotografo_id IN (
            SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
        )
    );

-- Policies: leads_propostas
DROP POLICY IF EXISTS "Fotógrafo vê seus próprios leads"  ON leads_propostas;
DROP POLICY IF EXISTS "Acesso público via link mágico"    ON leads_propostas;

CREATE POLICY "Fotógrafo vê seus próprios leads"
    ON leads_propostas FOR ALL
    USING (
        fotografo_id IN (
            SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
        )
    );

-- Policy especial: Portal do Cliente acessa via link_magico_token (sem autenticação)
CREATE POLICY "Acesso público via link mágico"
    ON leads_propostas FOR SELECT
    USING (
        link_magico_token IS NOT NULL AND
        status IN ('aprovado', 'confirmado')
    );


-- ============================================================
-- DADOS DE EXEMPLO (Seed)
-- Descomente para popular o banco durante desenvolvimento
-- ============================================================

/*
-- 1. Inserir perfil de fotógrafo (após criar usuário no Supabase Auth)
INSERT INTO perfil_fotografo (user_id, nome_comercial, cpf_cnpj, whatsapp, chave_pix)
VALUES (
    '00000000-0000-0000-0000-000000000001',  -- substitua pelo auth.uid() real
    'Studio Lumina',
    '12.345.678/0001-90',
    '+55 11 99999-0000',
    'financeiro@studiolumina.com.br'
);

-- 2. Inserir modelo de contrato com variáveis dinâmicas
INSERT INTO modelos_contrato (fotografo_id, nome_template, tipo_sessao, minuta_html, valor_base, limite_fotos_contrato)
VALUES (
    (SELECT id FROM perfil_fotografo WHERE nome_comercial = 'Studio Lumina'),
    'Contrato Newborn Premium',
    'newborn',
    '<h1>CONTRATO DE SERVIÇO FOTOGRÁFICO</h1>
     <p>Contratante: <strong>{{nome_cliente}}</strong> — E-mail: {{email_cliente}}</p>
     <p>Contratada: <strong>{{nome_comercial}}</strong> — CNPJ: {{cnpj_fotografo}}</p>
     <p>Serviço: Ensaio Newborn | Data: <strong>{{data_sessao}}</strong></p>
     <p>Valor Total: <strong>{{valor_total}}</strong> | Sinal: <strong>{{valor_sinal}}</strong></p>
     <p>Pagamento via Pix: {{pix_estudio}}</p>
     <p>Entrega de até <strong>{{limite_fotos}}</strong> fotos editadas em alta resolução.</p>',
    1200.00,
    30
);

-- 3. Inserir etapas do pipeline de vendas
INSERT INTO etapas_pipeline (fotografo_id, nome_etapa, ordem, tipo_pipeline) VALUES
    ((SELECT id FROM perfil_fotografo WHERE nome_comercial = 'Studio Lumina'), 'Novo Lead',           1, 'vendas'),
    ((SELECT id FROM perfil_fotografo WHERE nome_comercial = 'Studio Lumina'), 'Reunião Agendada',    2, 'vendas'),
    ((SELECT id FROM perfil_fotografo WHERE nome_comercial = 'Studio Lumina'), 'Proposta Enviada',    3, 'vendas'),
    ((SELECT id FROM perfil_fotografo WHERE nome_comercial = 'Studio Lumina'), 'Aguardando Sinal',    4, 'vendas');

-- 4. Inserir um lead de exemplo
INSERT INTO leads_propostas (
    fotografo_id, nome_cliente, whatsapp_cliente, email_cliente,
    tipo_servico, data_pretendida, valor_estimado, status
)
VALUES (
    (SELECT id FROM perfil_fotografo WHERE nome_comercial = 'Studio Lumina'),
    'Maria da Silva',
    '+55 11 98888-1234',
    'maria@exemplo.com',
    'newborn',
    '2026-08-15',
    1200.00,
    'novo'
);
*/
