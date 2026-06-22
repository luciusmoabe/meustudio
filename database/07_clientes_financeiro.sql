-- ============================================================
-- MIGRATION: 07_clientes_financeiro.sql
-- Épico 6: Gestão Avançada de Clientes (CRM)
-- Épico 7: Módulo Financeiro & Controle de Parcelas
-- ============================================================

-- ============================================================
-- TABELA 1: clientes
-- ============================================================
CREATE TABLE IF NOT EXISTS clientes (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    nome                    TEXT            NOT NULL,
    email                   TEXT,
    whatsapp                TEXT,
    instagram               TEXT,
    created_at              TIMESTAMPTZ     DEFAULT now(),
    updated_at              TIMESTAMPTZ     DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo acessa apenas seus clientes" ON clientes;
CREATE POLICY "Fotógrafo acessa apenas seus clientes"
    ON clientes FOR ALL
    USING ( fotografo_id = (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()) );

-- ============================================================
-- MIGRAÇÃO DE DADOS (Leads -> Clientes)
-- ============================================================
-- 1. Cria a coluna na tabela de propostas
ALTER TABLE leads_propostas 
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

-- 2. Insere clientes únicos com base no email (ou whatsapp como fallback)
INSERT INTO clientes (fotografo_id, nome, email, whatsapp)
SELECT DISTINCT ON (COALESCE(email_cliente, whatsapp_cliente, nome_cliente)) 
       fotografo_id, nome_cliente, email_cliente, whatsapp_cliente
FROM leads_propostas
WHERE nome_cliente IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Atualiza os leads vinculando ao novo cliente gerado
UPDATE leads_propostas lp
SET cliente_id = c.id
FROM clientes c
WHERE lp.fotografo_id = c.fotografo_id 
  AND (lp.email_cliente = c.email OR lp.whatsapp_cliente = c.whatsapp OR lp.nome_cliente = c.nome)
  AND lp.cliente_id IS NULL;


-- ============================================================
-- TABELA 2: parcelas (Contas a Receber)
-- ============================================================
CREATE TABLE IF NOT EXISTS parcelas (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    cliente_id              UUID            REFERENCES clientes(id) ON DELETE SET NULL,
    lead_id                 UUID            REFERENCES leads_propostas(id) ON DELETE CASCADE,
    numero_parcela          INTEGER         NOT NULL,
    valor                   NUMERIC(10,2)   NOT NULL,
    data_vencimento         DATE            NOT NULL,
    status                  TEXT            NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago', 'atrasado'
    cobrada_em              TIMESTAMPTZ,    -- Data que o cron enviou aviso
    link_pagamento          TEXT,           -- Opcional (Gateway)
    created_at              TIMESTAMPTZ     DEFAULT now(),
    updated_at              TIMESTAMPTZ     DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo acessa apenas suas parcelas" ON parcelas;
CREATE POLICY "Fotógrafo acessa apenas suas parcelas"
    ON parcelas FOR ALL
    USING ( fotografo_id = (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()) );
