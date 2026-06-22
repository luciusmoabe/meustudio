-- ============================================================
-- MIGRATION: 13_clientes_auto_create.sql
-- Épico: Gestão de Clientes (CRM)
-- Garante a criação automática do cliente ao aprovar o lead.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_cria_cliente_ao_aprovar_lead()
RETURNS TRIGGER AS $$
DECLARE
    novo_cliente_id UUID;
BEGIN
    -- Se o lead for aprovado e ainda não tiver um cliente vinculado
    IF NEW.status = 'aprovado' AND OLD.status IS DISTINCT FROM 'aprovado' AND NEW.cliente_id IS NULL THEN
        
        -- Verificar se já existe um cliente com o mesmo email/whatsapp para este fotógrafo
        SELECT id INTO novo_cliente_id 
        FROM clientes 
        WHERE fotografo_id = NEW.fotografo_id 
          AND (
               (NEW.email_cliente IS NOT NULL AND email = NEW.email_cliente) 
               OR 
               (NEW.whatsapp_cliente IS NOT NULL AND whatsapp = NEW.whatsapp_cliente)
          )
        LIMIT 1;

        -- Se não existir, cria um novo
        IF novo_cliente_id IS NULL THEN
            INSERT INTO clientes (fotografo_id, nome, email, whatsapp)
            VALUES (NEW.fotografo_id, NEW.nome_cliente, NEW.email_cliente, NEW.whatsapp_cliente)
            RETURNING id INTO novo_cliente_id;
        END IF;

        -- Vincula o cliente ao lead
        NEW.cliente_id := novo_cliente_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cria_cliente_aprovacao ON leads_propostas;
CREATE TRIGGER trigger_cria_cliente_aprovacao
BEFORE UPDATE ON leads_propostas
FOR EACH ROW
EXECUTE FUNCTION trg_cria_cliente_ao_aprovar_lead();

-- ============================================================
-- PROCESSAMENTO RETROATIVO
-- ============================================================
-- Corrige leads que já foram aprovados e ficaram sem cliente_id
DO $$
DECLARE
    lead_row RECORD;
    c_id UUID;
BEGIN
    FOR lead_row IN SELECT * FROM leads_propostas WHERE status = 'aprovado' AND cliente_id IS NULL LOOP
        
        -- Procura cliente existente
        SELECT id INTO c_id 
        FROM clientes 
        WHERE fotografo_id = lead_row.fotografo_id 
          AND (
               (lead_row.email_cliente IS NOT NULL AND email = lead_row.email_cliente) 
               OR 
               (lead_row.whatsapp_cliente IS NOT NULL AND whatsapp = lead_row.whatsapp_cliente)
          )
        LIMIT 1;

        -- Cria se não existe
        IF c_id IS NULL THEN
            INSERT INTO clientes (fotografo_id, nome, email, whatsapp)
            VALUES (lead_row.fotografo_id, lead_row.nome_cliente, lead_row.email_cliente, lead_row.whatsapp_cliente)
            RETURNING id INTO c_id;
        END IF;

        -- Atualiza o lead
        UPDATE leads_propostas SET cliente_id = c_id WHERE id = lead_row.id;
        
        -- Atualiza parcelas órfãs desse lead para referenciar o cliente correto
        UPDATE parcelas SET cliente_id = c_id WHERE lead_id = lead_row.id AND cliente_id IS NULL;
        
    END LOOP;
END;
$$;
