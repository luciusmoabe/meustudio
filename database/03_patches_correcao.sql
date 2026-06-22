-- ============================================================
--  MeuStudio — Patches de Correção (aplique no Supabase SQL Editor)
--  Execute este script após os schemas 01 e 02
-- ============================================================

-- ============================================================
-- PATCH 1: Permitir que clientes via link mágico ATUALIZEM
--          suas seleções de fotos na galeria (RF16)
-- ============================================================
DROP POLICY IF EXISTS "Cliente atualiza seleção via link mágico" ON midias_galeria;

CREATE POLICY "Cliente atualiza seleção via link mágico"
    ON midias_galeria FOR UPDATE
    USING (
        visivel_cliente = TRUE AND
        sessao_id IN (
            SELECT s.id FROM sessoes_agenda s
            JOIN leads_propostas l ON l.id = s.lead_id
            WHERE l.link_magico_token IS NOT NULL
            AND l.status IN ('aprovado', 'confirmado')
        )
    )
    WITH CHECK (
        sessao_id IN (
            SELECT s.id FROM sessoes_agenda s
            JOIN leads_propostas l ON l.id = s.lead_id
            WHERE l.link_magico_token IS NOT NULL
            AND l.status IN ('aprovado', 'confirmado')
        )
    );

-- ============================================================
-- PATCH 2: Permitir SELECT público de perfil_fotografo
--          para exibir dados do estúdio no Portal do Cliente
--          (necessário porque o portal é sem auth)
-- ============================================================
DROP POLICY IF EXISTS "Portal cliente vê dados do estúdio" ON perfil_fotografo;

CREATE POLICY "Portal cliente vê dados do estúdio"
    ON perfil_fotografo FOR SELECT
    USING (
        -- Permite acesso se o fotógrafo tem algum lead ativo com token
        id IN (
            SELECT DISTINCT fotografo_id FROM leads_propostas
            WHERE link_magico_token IS NOT NULL
            AND status IN ('aprovado', 'confirmado')
        )
    );

-- ============================================================
-- PATCH 3: Confirma que a constraint chk_status_aprovado
--          funciona corretamente com o novo fluxo
--          (já inclui modelo_contrato_id obrigatório)
-- Esta é apenas uma verificação — a constraint já existe.
-- ============================================================
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname = 'chk_status_aprovado';

-- ============================================================
-- VERIFICAÇÃO: Listar todas as policies ativas
-- ============================================================
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
