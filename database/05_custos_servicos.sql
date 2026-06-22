-- ============================================================
-- MeuStudio — Upgrade do Esquema de Tipos de Serviço e Custos
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Adicionar campos avançados na tabela tipos_sessao para automação de agenda e finanças
ALTER TABLE tipos_sessao 
ADD COLUMN IF NOT EXISTS duracao_minutos   INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS valor_sugerido     NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS limite_fotos_def   INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cor_hex            TEXT DEFAULT '#6366f1',
ADD COLUMN IF NOT EXISTS descricao          TEXT;

-- 2. Criar a tabela de itens de custo associados a cada tipo de serviço (COGS/Margem)
CREATE TABLE IF NOT EXISTS custos_servico (
    id                UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_sessao_id    UUID            NOT NULL REFERENCES tipos_sessao(id) ON DELETE CASCADE,
    nome_custo        TEXT            NOT NULL,             -- Ex: "Álbum Impresso", "Assistente"
    valor             NUMERIC(10,2)   NOT NULL DEFAULT 0.00, -- Valor de custo unitário
    categoria         TEXT            NOT NULL DEFAULT 'outros' -- 'entrega', 'equipe', 'producao', 'deslocamento', 'outros'
        CHECK (categoria IN ('entrega', 'equipe', 'producao', 'deslocamento', 'outros')),
    criado_em         TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS (Row Level Security) na nova tabela para isolamento de dados
ALTER TABLE custos_servico ENABLE ROW LEVEL SECURITY;

-- 4. Criar a política de RLS para a tabela de custos
-- Garante que o fotógrafo só consiga ver/editar custos vinculados aos seus próprios tipos de sessão
DROP POLICY IF EXISTS "Fotógrafo gerencia custos de seus serviços" ON custos_servico;

CREATE POLICY "Fotógrafo gerencia custos de seus serviços"
    ON custos_servico FOR ALL
    USING (
        tipo_sessao_id IN (
            SELECT id FROM tipos_sessao 
            WHERE fotografo_id IN (
                SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        tipo_sessao_id IN (
            SELECT id FROM tipos_sessao 
            WHERE fotografo_id IN (
                SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
            )
        )
    );
