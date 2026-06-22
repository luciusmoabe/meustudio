-- ============================================================
-- MIGRATION: 09_integridade_referencial.sql
-- Épico: Integridade e Tratamento de Erros
-- Protege entidades filhas de exclusão acidental em cascata.
-- ============================================================

-- 1. custos_servicos -> tipos_sessao
ALTER TABLE IF EXISTS custos_servicos DROP CONSTRAINT IF EXISTS custos_servicos_tipo_sessao_id_fkey;
ALTER TABLE IF EXISTS custos_servicos ADD CONSTRAINT custos_servicos_tipo_sessao_id_fkey FOREIGN KEY (tipo_sessao_id) REFERENCES tipos_sessao(id) ON DELETE RESTRICT;

-- 2. okr_key_results -> okr_objectives
ALTER TABLE IF EXISTS okr_key_results DROP CONSTRAINT IF EXISTS okr_key_results_objective_id_fkey;
ALTER TABLE IF EXISTS okr_key_results ADD CONSTRAINT okr_key_results_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES okr_objectives(id) ON DELETE RESTRICT;

-- 3. okr_checkins -> okr_key_results
ALTER TABLE IF EXISTS okr_checkins DROP CONSTRAINT IF EXISTS okr_checkins_key_result_id_fkey;
ALTER TABLE IF EXISTS okr_checkins ADD CONSTRAINT okr_checkins_key_result_id_fkey FOREIGN KEY (key_result_id) REFERENCES okr_key_results(id) ON DELETE RESTRICT;

-- 4. sessoes_agenda -> leads_propostas
ALTER TABLE IF EXISTS sessoes_agenda DROP CONSTRAINT IF EXISTS sessoes_agenda_lead_id_fkey;
ALTER TABLE IF EXISTS sessoes_agenda ADD CONSTRAINT sessoes_agenda_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads_propostas(id) ON DELETE RESTRICT;

-- 5. links_galeria -> sessoes_agenda
ALTER TABLE IF EXISTS links_galeria DROP CONSTRAINT IF EXISTS links_galeria_sessao_id_fkey;
ALTER TABLE IF EXISTS links_galeria ADD CONSTRAINT links_galeria_sessao_id_fkey FOREIGN KEY (sessao_id) REFERENCES sessoes_agenda(id) ON DELETE RESTRICT;

-- 6. contratos -> leads_propostas
ALTER TABLE IF EXISTS contratos DROP CONSTRAINT IF EXISTS contratos_lead_id_fkey;
ALTER TABLE IF EXISTS contratos ADD CONSTRAINT contratos_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads_propostas(id) ON DELETE RESTRICT;

-- 7. transacoes_financeiras -> leads_propostas
ALTER TABLE IF EXISTS transacoes_financeiras DROP CONSTRAINT IF EXISTS transacoes_financeiras_lead_id_fkey;
ALTER TABLE IF EXISTS transacoes_financeiras ADD CONSTRAINT transacoes_financeiras_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads_propostas(id) ON DELETE RESTRICT;
