-- ============================================================
-- MeuStudio — Patch: Cobrança Dinâmica de Fotos Extras
-- ============================================================

-- 1. Adicionar o valor da foto extra na configuração do tipo de serviço
ALTER TABLE tipos_sessao ADD COLUMN IF NOT EXISTS valor_foto_extra NUMERIC(10,2) DEFAULT 25.00;

-- 2. Adicionar o valor da foto extra na sessão agendada (para negociações pontuais)
ALTER TABLE sessoes_agenda ADD COLUMN IF NOT EXISTS valor_foto_extra NUMERIC(10,2) DEFAULT 25.00;

-- 3. Adicionar sessao_id na tabela de pagamentos (para vincular o complemento)
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS sessao_id UUID REFERENCES sessoes_agenda(id) ON DELETE SET NULL;
