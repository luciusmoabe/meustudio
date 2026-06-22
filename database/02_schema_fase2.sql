-- ============================================================
--  MeuStudio SaaS — Esquema Fase 2
--  Tabelas: sessoes_agenda, midias_galeria, pagamentos
--  Plataforma: Supabase (PostgreSQL)
--  Versão: 1.0  |  PRD: v2.0 — RF08, RF10~RF18
-- ============================================================

-- ============================================================
-- ENUM TYPES — Fase 2 (idempotente)
-- ============================================================

-- Status da sessão de campo
DO $$ BEGIN
    CREATE TYPE status_sessao AS ENUM (
        'reserva_temporaria',   -- Agenda bloqueada após aprovação (RF07)
        'confirmada',           -- Sinal pago (RF11)
        'em_producao',          -- Fotógrafo está com o Kanban ativo (RF14)
        'fotografada',          -- Sessão realizada
        'em_edicao',            -- Em pós-produção
        'pronta_entrega',       -- Galeria publicada aguardando seleção
        'entregue',             -- Cliente finalizou a seleção
        'cancelada'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status do pagamento
DO $$ BEGIN
    CREATE TYPE status_pagamento AS ENUM (
        'pendente',
        'aguardando_compensacao',
        'pago',
        'estornado',
        'falhou'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Meio de pagamento utilizado
DO $$ BEGIN
    CREATE TYPE meio_pagamento AS ENUM (
        'pix',
        'cartao_credito',
        'boleto'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tipo de cobrança
DO $$ BEGIN
    CREATE TYPE tipo_cobranca AS ENUM (
        'sinal',         -- Entrada inicial do contrato (RF10)
        'complemento',   -- Fotos extras além do limite (RF18)
        'pacote_extra',  -- Sessão adicional
        'outros'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- TABELA 5: sessoes_agenda
-- RF08 — Suporte a Combos/Pacotes (filho de leads_propostas)
-- RF12 — Automação da Google Agenda
-- RF13 — Convite Nativo para o Cliente
-- RF14 — Esteira de Produção (Kanban)
-- RF15 — Linha do Tempo do Portal do Cliente
-- ============================================================
CREATE TABLE IF NOT EXISTS sessoes_agenda (
    -- Identidade
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Hierarquia: sessão pertence a um contrato/lead (RF08 — 1:N)
    lead_id                 UUID            NOT NULL REFERENCES leads_propostas(id) ON DELETE CASCADE,

    -- Multi-tenancy (desnormalizado para performance e RLS)
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,

    -- Dados da Sessão
    titulo_sessao           TEXT            NOT NULL,       -- Ex: "Parto", "Newborn", "Casamento - Cerimônia"
    tipo_sessao             tipo_sessao     NOT NULL DEFAULT 'outros',
    descricao               TEXT,

    -- Agendamento
    data_hora_inicio        TIMESTAMPTZ     NOT NULL,
    data_hora_fim           TIMESTAMPTZ,
    duracao_minutos         INTEGER,                        -- Calculado ou informado
    local_sessao            TEXT,                           -- Endereço ou nome do local
    local_lat               NUMERIC(10,7),                  -- Geolocalização (opcional)
    local_lng               NUMERIC(10,7),

    -- Status da Esteira de Produção (RF14)
    status                  status_sessao   NOT NULL DEFAULT 'reserva_temporaria',
    etapa_producao_id       UUID            REFERENCES etapas_pipeline(id) ON DELETE SET NULL,

    -- Integração Google Calendar (RF12 e RF13)
    google_event_id         TEXT,           -- ID do evento criado na Google Agenda para permitir remarcações
    google_event_link       TEXT,           -- Link do evento (hangoutLink ou htmlLink)
    google_synced_at        TIMESTAMPTZ,    -- Última sincronização com o Google Calendar

    -- Parâmetros do Contrato desta Sessão
    limite_fotos            INTEGER,        -- Teto de fotos desta sessão específica (RF18)
    fotos_selecionadas      INTEGER DEFAULT 0, -- Contador atualizado em tempo real

    -- Observações internas
    observacoes             TEXT,

    -- Auditoria
    criado_em               TIMESTAMPTZ     NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ     NOT NULL DEFAULT now(),

    -- Constraint: data de fim deve ser posterior ao início
    CONSTRAINT chk_datas_sessao CHECK (
        data_hora_fim IS NULL OR data_hora_fim > data_hora_inicio
    )
);

COMMENT ON TABLE sessoes_agenda IS 'Diárias de campo filhas de um contrato. Um lead pode ter N sessões (pacotes/combos — RF08). Sincronizadas com Google Calendar (RF12).';
COMMENT ON COLUMN sessoes_agenda.google_event_id IS 'ID do evento no Google Calendar. Permite atualização e cancelamento automático via API (RF12).';
COMMENT ON COLUMN sessoes_agenda.limite_fotos IS 'Teto de fotos desta sessão. Quando fotos_selecionadas >= limite_fotos, o sistema aciona a cobrança extra (RF18).';
COMMENT ON COLUMN sessoes_agenda.etapa_producao_id IS 'Coluna atual da sessão no Kanban de produção (RF14). FK para etapas_pipeline com tipo_pipeline = producao.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_sessoes_lead_id         ON sessoes_agenda(lead_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_fotografo_id    ON sessoes_agenda(fotografo_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_status          ON sessoes_agenda(fotografo_id, status);
CREATE INDEX IF NOT EXISTS idx_sessoes_data            ON sessoes_agenda(fotografo_id, data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_sessoes_google_event    ON sessoes_agenda(google_event_id);


-- ============================================================
-- TABELA 6: midias_galeria
-- RF16 — Galeria de Seleção Inteligente
-- RF17 — Proteção Anti-Print (marca d'água)
-- RF18 — Trava de Limite e Monetização Extra
-- ============================================================
CREATE TABLE IF NOT EXISTS midias_galeria (
    -- Identidade
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Hierarquia: foto pertence a uma sessão
    sessao_id               UUID            NOT NULL REFERENCES sessoes_agenda(id) ON DELETE CASCADE,

    -- Multi-tenancy
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,

    -- Arquivo
    nome_arquivo            TEXT            NOT NULL,
    storage_path            TEXT            NOT NULL,       -- Caminho no Supabase Storage (bucket privado)
    storage_path_thumb      TEXT,                           -- Thumbnail otimizado para o grid da galeria
    storage_path_watermark  TEXT,                           -- Versão com marca d'água para visualização (RF17)
    mime_type               TEXT DEFAULT 'image/jpeg',
    tamanho_bytes           BIGINT,
    largura_px              INTEGER,
    altura_px               INTEGER,

    -- Seleção pelo Cliente (RF16)
    selecionada             BOOLEAN         NOT NULL DEFAULT FALSE,
    selecionada_em          TIMESTAMPTZ,                    -- Timestamp da seleção/deseleção
    favorita                BOOLEAN         NOT NULL DEFAULT FALSE, -- Ícone de coração (RF16)

    -- Ordenação e Exibição
    ordem_exibicao          INTEGER,                        -- Posição no grid da galeria
    visivel_cliente         BOOLEAN         NOT NULL DEFAULT TRUE, -- Controle de visibilidade pelo fotógrafo

    -- Metadata da Foto
    exif_data               JSONB,                          -- Dados EXIF (câmera, ISO, abertura, etc.)
    tags                    TEXT[],                         -- Tags para busca interna

    -- Auditoria
    criado_em               TIMESTAMPTZ     NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE midias_galeria IS 'Fotos brutas de cada sessão. Exibidas em grid no Portal do Cliente (RF16) com marca d'água (RF17). Seleção ativa o limite e cobrança extra (RF18).';
COMMENT ON COLUMN midias_galeria.storage_path IS 'Caminho no bucket PRIVADO do Supabase Storage. O acesso é controlado por signed URLs geradas pelo servidor.';
COMMENT ON COLUMN midias_galeria.storage_path_watermark IS 'Versão com marca d`água semitransparente. É esta URL que o Portal do Cliente exibe (RF17).';
COMMENT ON COLUMN midias_galeria.selecionada IS 'True quando o cliente clicou no coração (RF16). Incrementa fotos_selecionadas na sessao_agenda.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_midias_sessao_id        ON midias_galeria(sessao_id);
CREATE INDEX IF NOT EXISTS idx_midias_fotografo_id     ON midias_galeria(fotografo_id);
CREATE INDEX IF NOT EXISTS idx_midias_selecionada      ON midias_galeria(sessao_id, selecionada);
CREATE INDEX IF NOT EXISTS idx_midias_ordem            ON midias_galeria(sessao_id, ordem_exibicao);


-- ============================================================
-- TABELA 7: pagamentos
-- RF10 — Gateway Multimeios Integrado (Pix, Cartão, Boleto)
-- RF11 — Webhook de Confirmação
-- RF18 — Cobrança Complementar por Fotos Extras
-- ============================================================
CREATE TABLE IF NOT EXISTS pagamentos (
    -- Identidade
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Hierarquia: pagamento pertence a um contrato/lead
    lead_id                 UUID            NOT NULL REFERENCES leads_propostas(id) ON DELETE CASCADE,

    -- Multi-tenancy
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,

    -- Classificação da Cobrança
    tipo_cobranca           tipo_cobranca   NOT NULL DEFAULT 'sinal',
    descricao               TEXT,           -- Ex: "+3 fotos extras (RF18)"

    -- Valores
    valor_bruto             NUMERIC(10,2)   NOT NULL,
    valor_taxa_gateway      NUMERIC(10,2) DEFAULT 0.00,   -- Taxa cobrada pelo Stripe/Asaas
    valor_liquido           NUMERIC(10,2)   GENERATED ALWAYS AS (valor_bruto - valor_taxa_gateway) STORED,

    -- Gateway de Pagamento (Stripe ou Asaas)
    gateway                 TEXT            CHECK (gateway IN ('stripe', 'asaas')),
    gateway_charge_id       TEXT,           -- ID da cobrança no gateway (para reconciliação)
    gateway_customer_id     TEXT,           -- ID do cliente no gateway

    -- Meio e Status
    meio_pagamento          meio_pagamento,
    status                  status_pagamento NOT NULL DEFAULT 'pendente',

    -- Pix
    pix_qrcode_url          TEXT,           -- URL da imagem do QR Code
    pix_copia_cola          TEXT,           -- Código "Copia e Cola"
    pix_expira_em           TIMESTAMPTZ,

    -- Cartão de Crédito
    cartao_parcelas         INTEGER DEFAULT 1,
    cartao_ultimos4         TEXT,           -- Últimos 4 dígitos (nunca armazenar número completo)
    cartao_bandeira         TEXT,           -- Visa, Master, etc.

    -- Boleto
    boleto_url              TEXT,           -- URL do PDF do boleto
    boleto_linha_digitavel  TEXT,
    boleto_vencimento       DATE,

    -- Webhook (RF11)
    webhook_recebido_em     TIMESTAMPTZ,    -- Quando o gateway confirmou o pagamento
    webhook_payload         JSONB,          -- Payload raw do webhook para auditoria

    -- Confirmação e Compensação
    pago_em                 TIMESTAMPTZ,    -- Momento da compensação efetiva
    estornado_em            TIMESTAMPTZ,

    -- Auditoria
    criado_em               TIMESTAMPTZ     NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE pagamentos IS 'Histórico de todas as cobranças do contrato: sinal (RF10), extras de fotos (RF18). Confirmação via webhook (RF11).';
COMMENT ON COLUMN pagamentos.gateway_charge_id IS 'ID da cobrança no Stripe (PaymentIntent ID) ou Asaas. Usado para reconciliação e estorno.';
COMMENT ON COLUMN pagamentos.valor_liquido IS 'Coluna calculada automaticamente: valor_bruto - valor_taxa_gateway.';
COMMENT ON COLUMN pagamentos.webhook_payload IS 'Payload raw do webhook do gateway. Essencial para auditoria e reprocessamento em caso de falha.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagamentos_lead_id          ON pagamentos(lead_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_fotografo_id     ON pagamentos(fotografo_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status           ON pagamentos(fotografo_id, status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_gateway_charge   ON pagamentos(gateway_charge_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_pago_em          ON pagamentos(fotografo_id, pago_em);


-- ============================================================
-- TRIGGERS — Fase 2 (idempotente)
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_sessoes_agenda ON sessoes_agenda;
CREATE TRIGGER set_timestamp_sessoes_agenda
    BEFORE UPDATE ON sessoes_agenda
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_midias_galeria ON midias_galeria;
CREATE TRIGGER set_timestamp_midias_galeria
    BEFORE UPDATE ON midias_galeria
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_pagamentos ON pagamentos;
CREATE TRIGGER set_timestamp_pagamentos
    BEFORE UPDATE ON pagamentos
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();


-- ============================================================
-- TRIGGER ESPECIAL: Atualiza contador fotos_selecionadas na sessao_agenda
-- Disparado sempre que o cliente seleciona/desseleciona uma foto (RF18)
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_atualiza_fotos_selecionadas()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessoes_agenda
    SET fotos_selecionadas = (
        SELECT COUNT(*) FROM midias_galeria
        WHERE sessao_id = COALESCE(NEW.sessao_id, OLD.sessao_id)
        AND selecionada = TRUE
    )
    WHERE id = COALESCE(NEW.sessao_id, OLD.sessao_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_fotos_selecionadas ON midias_galeria;
CREATE TRIGGER trigger_fotos_selecionadas
    AFTER INSERT OR UPDATE OF selecionada OR DELETE ON midias_galeria
    FOR EACH ROW EXECUTE FUNCTION trigger_atualiza_fotos_selecionadas();


-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Fase 2
-- ============================================================
ALTER TABLE sessoes_agenda  ENABLE ROW LEVEL SECURITY;
ALTER TABLE midias_galeria  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos      ENABLE ROW LEVEL SECURITY;

-- sessoes_agenda
DROP POLICY IF EXISTS "Fotógrafo vê suas próprias sessões" ON sessoes_agenda;
CREATE POLICY "Fotógrafo vê suas próprias sessões"
    ON sessoes_agenda FOR ALL
    USING (fotografo_id IN (
        SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
    ));

-- Acesso público via link mágico do lead (Portal do Cliente — RF15)
DROP POLICY IF EXISTS "Cliente acessa sessões via link mágico" ON sessoes_agenda;
CREATE POLICY "Cliente acessa sessões via link mágico"
    ON sessoes_agenda FOR SELECT
    USING (
        lead_id IN (
            SELECT id FROM leads_propostas
            WHERE link_magico_token IS NOT NULL
            AND status IN ('aprovado', 'confirmado')
        )
    );

-- midias_galeria
DROP POLICY IF EXISTS "Fotógrafo vê suas próprias mídias" ON midias_galeria;
CREATE POLICY "Fotógrafo vê suas próprias mídias"
    ON midias_galeria FOR ALL
    USING (fotografo_id IN (
        SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
    ));

-- Cliente vê apenas fotos visíveis da sua galeria (RF16)
DROP POLICY IF EXISTS "Cliente acessa galeria via link mágico" ON midias_galeria;
CREATE POLICY "Cliente acessa galeria via link mágico"
    ON midias_galeria FOR SELECT
    USING (
        visivel_cliente = TRUE AND
        sessao_id IN (
            SELECT s.id FROM sessoes_agenda s
            JOIN leads_propostas l ON l.id = s.lead_id
            WHERE l.link_magico_token IS NOT NULL
            AND l.status IN ('aprovado', 'confirmado')
        )
    );

-- pagamentos
DROP POLICY IF EXISTS "Fotógrafo vê seus próprios pagamentos" ON pagamentos;
CREATE POLICY "Fotógrafo vê seus próprios pagamentos"
    ON pagamentos FOR ALL
    USING (fotografo_id IN (
        SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
    ));
