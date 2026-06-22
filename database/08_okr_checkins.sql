-- ============================================================
-- MIGRATION: 08_okr_checkins.sql
-- Épico 8: Check-ins de OKRs e Frequência (CRUD Completo)
-- ============================================================

-- 1. Adicionar coluna de frequência no KR
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS frequencia_checkin TEXT DEFAULT 'mensal';

-- 2. Tabela de Histórico de Check-ins
CREATE TABLE IF NOT EXISTS okr_checkins (
    id                      UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_result_id           UUID            NOT NULL REFERENCES okr_key_results(id) ON DELETE CASCADE,
    fotografo_id            UUID            NOT NULL REFERENCES perfil_fotografo(id) ON DELETE CASCADE,
    valor_registrado        NUMERIC(10,2)   NOT NULL,
    comentario              TEXT,
    created_at              TIMESTAMPTZ     DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE okr_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fotógrafo acessa apenas seus checkins" ON okr_checkins;
CREATE POLICY "Fotógrafo acessa apenas seus checkins"
    ON okr_checkins FOR ALL
    USING ( fotografo_id = (SELECT id FROM perfil_fotografo WHERE user_id = auth.uid()) );

-- 3. Trigger para atualizar o valor_atual do KR quando um check-in for criado, atualizado ou excluído
CREATE OR REPLACE FUNCTION update_kr_from_checkin()
RETURNS TRIGGER AS $$
DECLARE
    v_kr_id UUID;
    v_latest_val NUMERIC;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_kr_id := OLD.key_result_id;
    ELSE
        v_kr_id := NEW.key_result_id;
    END IF;

    -- Pega o valor do check-in mais recente
    SELECT valor_registrado INTO v_latest_val
    FROM okr_checkins
    WHERE key_result_id = v_kr_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se não houver check-ins, volta para o valor inicial do KR
    IF v_latest_val IS NULL THEN
        SELECT valor_inicial INTO v_latest_val
        FROM okr_key_results
        WHERE id = v_kr_id;
    END IF;

    -- Atualiza o valor atual do KR
    UPDATE okr_key_results
    SET valor_atual = v_latest_val, updated_at = now()
    WHERE id = v_kr_id;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_kr_from_checkin ON okr_checkins;
CREATE TRIGGER trigger_update_kr_from_checkin
AFTER INSERT OR UPDATE OR DELETE ON okr_checkins
FOR EACH ROW
EXECUTE FUNCTION update_kr_from_checkin();
