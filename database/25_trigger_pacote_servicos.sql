CREATE OR REPLACE FUNCTION validar_transicao_etapa()
RETURNS TRIGGER AS $$
DECLARE
    regras JSONB;
    destino_id UUID;
    origem_pacote_id UUID;
    lead_pacote_id UUID;
    norm_tipo TEXT;
BEGIN
    -- Só valida se etapa_pipeline_id está mudando
    IF OLD.etapa_pipeline_id IS NOT DISTINCT FROM NEW.etapa_pipeline_id THEN
        RETURN NEW;
    END IF;

    -- Se vindo de NULL (lead novo), permite qualquer destino
    IF OLD.etapa_pipeline_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Busca as regras e o pacote (serviço) da etapa de origem
    SELECT ep.transicoes_permitidas, ep.pacote_id INTO regras, origem_pacote_id
    FROM etapas_pipeline ep
    WHERE ep.id = OLD.etapa_pipeline_id;

    -- Se a etapa de origem for exclusiva de um serviço, verifica se o lead pertence a esse serviço
    -- (seja diretamente, ou porque o pacote do lead contém esse serviço)
    IF origem_pacote_id IS NOT NULL THEN
        IF NEW.pacote_id IS NOT NULL THEN
            lead_pacote_id := NEW.pacote_id;
        ELSE
            -- Tenta inferir pelo nome do tipo_servico
            BEGIN
                lead_pacote_id := NEW.tipo_servico::uuid;
            EXCEPTION WHEN invalid_text_representation THEN
                norm_tipo := lower(regexp_replace(NEW.tipo_servico, '\s+', ' ', 'g'));
                SELECT id INTO lead_pacote_id FROM tipos_sessao 
                WHERE lower(regexp_replace(nome, '\s+', ' ', 'g')) = norm_tipo LIMIT 1;
            END;
        END IF;

        IF lead_pacote_id IS NOT NULL THEN
            IF lead_pacote_id = origem_pacote_id THEN
                -- Match direto: o lead tem o serviço exato da etapa
                NULL;
            ELSIF EXISTS (SELECT 1 FROM pacote_servicos WHERE pacote_id = lead_pacote_id AND servico_id = origem_pacote_id) THEN
                -- Match indireto: o lead tem um pacote que CONTÉM o serviço da etapa!
                -- Então consideramos que ele pertence a essa etapa. Forçamos o match.
                lead_pacote_id := origem_pacote_id;
            END IF;
        END IF;

        -- Se mesmo assim não houver match, o lead não pertence às regras desta etapa.
        IF lead_pacote_id IS NULL OR lead_pacote_id IS DISTINCT FROM origem_pacote_id THEN
            -- O lead está em uma etapa emprestada por fallback. Liberando movimentação total!
            RETURN NEW;
        END IF;
    END IF;

    -- Se não há regras definidas, movimento livre
    IF regras IS NULL OR jsonb_array_length(regras) = 0 THEN
        RETURN NEW;
    END IF;

    -- Verifica se o destino está na lista de transições permitidas
    destino_id := NEW.etapa_pipeline_id;
    IF NOT regras @> to_jsonb(destino_id::text) THEN
        RAISE EXCEPTION 'Transição não permitida: a etapa de origem não permite mover para esta etapa de destino.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
