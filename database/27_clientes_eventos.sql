-- ============================================================
-- MIGRATION: 27_clientes_eventos.sql
-- Épico: CRM de Alta Conversão (LTV)
-- Adiciona documentos, endereço e sistema de Eventos/Datas Comemorativas.
-- ============================================================

-- 1. Criação do Enum para Tipos de Eventos (Opcional, mas útil para o front-end)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_evento_cliente') THEN
        CREATE TYPE tipo_evento_cliente AS ENUM ('aniversario', 'aniversario_filho', 'bodas', 'formatura', 'outros');
    END IF;
END$$;

-- 2. Adicionar novas colunas demográficas na tabela 'clientes'
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS rg TEXT,
ADD COLUMN IF NOT EXISTS data_nascimento DATE,
ADD COLUMN IF NOT EXISTS endereco TEXT;

-- 3. Criar a nova tabela de Eventos e Datas Comemorativas
CREATE TABLE IF NOT EXISTS clientes_eventos (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID            NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    tipo_evento     tipo_evento_cliente NOT NULL DEFAULT 'outros',
    nome_pessoas    TEXT            NOT NULL, -- Ex: "Joãozinho (Filho)" ou "Maria e Marcos"
    data_evento     DATE            NOT NULL, -- O ano pode ser o de nascimento/casamento para calcular a idade
    
    observacao      TEXT,
    
    criado_em       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- 4. Índices para performance no Motor de Automação (Busca por data)
CREATE INDEX IF NOT EXISTS idx_clientes_eventos_data ON clientes_eventos(data_evento);
CREATE INDEX IF NOT EXISTS idx_clientes_eventos_cliente ON clientes_eventos(cliente_id);

-- 5. Habilitar RLS e criar política de segurança
ALTER TABLE clientes_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo acessa os eventos dos seus clientes" ON clientes_eventos;
CREATE POLICY "Fotógrafo acessa os eventos dos seus clientes"
    ON clientes_eventos FOR ALL
    USING (
        cliente_id IN (
            SELECT id FROM clientes 
            WHERE fotografo_id IN (
                SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        cliente_id IN (
            SELECT id FROM clientes 
            WHERE fotografo_id IN (
                SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()
            )
        )
    );
