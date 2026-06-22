-- ============================================================
-- MIGRATION: 14_limpeza_clientes_orfaos.sql
-- Épico: Gestão de Clientes (CRM)
-- Objetivo: Limpar clientes fantasmas/órfãos que não possuem nenhum projeto atrelado.
-- ============================================================

DELETE FROM clientes
WHERE id NOT IN (
    SELECT DISTINCT cliente_id 
    FROM leads_propostas 
    WHERE cliente_id IS NOT NULL
);
