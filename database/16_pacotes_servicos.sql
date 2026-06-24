-- ============================================================
-- MeuStudio — Separação de Serviços e Pacotes
-- ============================================================

-- 1. Adicionar flag para identificar se o "tipo_sessao" é um Pacote ou Serviço Simples
ALTER TABLE tipos_sessao 
ADD COLUMN IF NOT EXISTS is_pacote BOOLEAN DEFAULT false;

-- 2. Criar tabela de vínculo entre Pacotes e Serviços
CREATE TABLE IF NOT EXISTS pacote_servicos (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    pacote_id       UUID            NOT NULL REFERENCES tipos_sessao(id) ON DELETE CASCADE,
    servico_id      UUID            NOT NULL REFERENCES tipos_sessao(id) ON DELETE RESTRICT,
    quantidade      INTEGER         NOT NULL DEFAULT 1,
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- Garante que um mesmo serviço não seja adicionado duas vezes ao mesmo pacote
    CONSTRAINT pacote_servicos_unico UNIQUE(pacote_id, servico_id)
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE pacote_servicos ENABLE ROW LEVEL SECURITY;

-- 4. Criar política de RLS
DROP POLICY IF EXISTS "Fotógrafo gerencia itens dos seus pacotes" ON pacote_servicos;
CREATE POLICY "Fotógrafo gerencia itens dos seus pacotes"
    ON pacote_servicos FOR ALL
    USING (
        pacote_id IN (
            SELECT id FROM tipos_sessao 
            WHERE fotografo_id IN (
                SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        pacote_id IN (
            SELECT id FROM tipos_sessao 
            WHERE fotografo_id IN (
                SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
            )
        )
    );
