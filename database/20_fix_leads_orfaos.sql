-- 20_fix_leads_orfaos.sql
-- Se algum lead ficar órfão (etapa_pipeline_id nulo ou inválido) devido a exclusão de funil, 
-- este script o recoloca na primeira etapa disponível do fotógrafo.
UPDATE leads_propostas lp
SET etapa_pipeline_id = COALESCE(
    (SELECT id FROM etapas_pipeline ep WHERE ep.pacote_id = lp.pacote_id AND ep.fotografo_id = lp.fotografo_id ORDER BY ordem ASC LIMIT 1),
    (SELECT id FROM etapas_pipeline ep WHERE ep.pacote_id IS NULL AND ep.fotografo_id = lp.fotografo_id ORDER BY ordem ASC LIMIT 1)
)
WHERE 
    etapa_pipeline_id IS NULL 
    OR 
    etapa_pipeline_id NOT IN (SELECT id FROM etapas_pipeline WHERE fotografo_id = lp.fotografo_id);
