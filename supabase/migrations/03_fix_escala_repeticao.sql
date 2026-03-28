-- =============================================
-- FIX: Escala repetindo mesmo membro
-- Problemas corrigidos:
-- 1. buscar_membros_disponiveis agora inclui rascunhos para considerar
--    quem já foi escalado na escala sendo gerada
-- 2. gerar_escala_automatica passa lista de excluídos por data
--    para evitar mesma pessoa em duas funções no mesmo culto
-- =============================================

CREATE OR REPLACE FUNCTION buscar_membros_disponiveis(
  p_funcao TEXT,
  p_data_culto DATE,
  p_igreja_id UUID,
  p_excluir_ids UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  membro_id UUID,
  nome TEXT,
  nivel TEXT,
  ultima_escalacao DATE,
  total_escalacoes_mes INT
) AS $$
BEGIN
  RETURN QUERY
  WITH escalacoes_recentes AS (
    SELECT
      CASE
        WHEN p_funcao = 'oracao'    THEN ed.membro_oracao_id
        WHEN p_funcao = 'louvor'    THEN ed.membro_louvor_id
        WHEN p_funcao = 'pregacao'  THEN ed.membro_pregacao_id
        WHEN p_funcao = 'som'       THEN ed.membro_som_id
        WHEN p_funcao = 'recepcao'  THEN ed.membro_recepcao_id
        WHEN p_funcao = 'midia'     THEN ed.membro_midia_id
        WHEN p_funcao = 'infantil'  THEN ed.membro_infantil_id
      END as membro_id_escalado,
      ed.data_culto
    FROM escalas_detalhes ed
    JOIN escalas e ON e.id = ed.escala_id
    WHERE e.igreja_id = p_igreja_id
      AND ed.data_culto <= p_data_culto
      -- Inclui rascunho para considerar quem já foi escalado na geração atual
      AND e.status IN ('finalizada', 'enviada', 'rascunho')
  )
  SELECT
    m.id as membro_id,
    m.nome,
    mf.nivel,
    MAX(er.data_culto) as ultima_escalacao,
    COUNT(er.membro_id_escalado) FILTER (
      WHERE er.data_culto >= date_trunc('month', p_data_culto)
      AND er.data_culto < date_trunc('month', p_data_culto) + interval '1 month'
    )::INT as total_escalacoes_mes
  FROM membros m
  INNER JOIN membros_funcoes mf ON mf.membro_id = m.id AND mf.ativo = TRUE
  LEFT JOIN escalacoes_recentes er ON er.membro_id_escalado = m.id
  WHERE m.igreja_id = p_igreja_id
    AND m.status = 'ativo'
    AND mf.funcao = p_funcao
    AND NOT (m.id = ANY(p_excluir_ids))
    AND (
      m.disponibilidade IS NULL OR
      m.disponibilidade->'dias' @> to_jsonb(EXTRACT(DOW FROM p_data_culto)::INT)
    )
  GROUP BY m.id, m.nome, mf.nivel
  ORDER BY
    total_escalacoes_mes ASC,
    ultima_escalacao ASC NULLS FIRST,
    CASE mf.nivel
      WHEN 'avancado'      THEN 1
      WHEN 'intermediario' THEN 2
      WHEN 'iniciante'     THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION gerar_escala_automatica(
  p_mes INT,
  p_ano INT,
  p_igreja_id UUID,
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_escala_id       UUID;
  v_culto           RECORD;
  v_data_culto      DATE;
  v_data_inicio     DATE;
  v_data_fim        DATE;
  -- IDs por função
  v_membro_oracao   UUID;
  v_membro_louvor   UUID;
  v_membro_pregacao UUID;
  v_membro_som      UUID;
  v_membro_recepcao UUID;
  v_membro_midia    UUID;
  v_membro_infantil UUID;
  -- Exclusões por culto (mesma data) para não repetir pessoa
  v_excluidos       UUID[];
BEGIN
  INSERT INTO escalas (mes, ano, igreja_id, status, created_by)
  VALUES (p_mes, p_ano, p_igreja_id, 'rascunho', p_created_by)
  RETURNING id INTO v_escala_id;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim    := (v_data_inicio + interval '1 month' - interval '1 day')::DATE;

  FOR v_culto IN
    SELECT * FROM cultos_regulares
    WHERE igreja_id = p_igreja_id AND ativo = TRUE
    ORDER BY dia_semana, horario
  LOOP
    v_data_culto := v_data_inicio;
    WHILE v_data_culto <= v_data_fim LOOP
      IF EXTRACT(DOW FROM v_data_culto) = v_culto.dia_semana THEN

        -- Zera exclusões para este culto específico
        v_excluidos := '{}';

        SELECT membro_id INTO v_membro_oracao
        FROM buscar_membros_disponiveis('oracao', v_data_culto, p_igreja_id, v_excluidos)
        LIMIT 1;
        IF v_membro_oracao IS NOT NULL THEN
          v_excluidos := array_append(v_excluidos, v_membro_oracao);
        END IF;

        SELECT membro_id INTO v_membro_louvor
        FROM buscar_membros_disponiveis('louvor', v_data_culto, p_igreja_id, v_excluidos)
        LIMIT 1;
        IF v_membro_louvor IS NOT NULL THEN
          v_excluidos := array_append(v_excluidos, v_membro_louvor);
        END IF;

        SELECT membro_id INTO v_membro_pregacao
        FROM buscar_membros_disponiveis('pregacao', v_data_culto, p_igreja_id, v_excluidos)
        LIMIT 1;
        IF v_membro_pregacao IS NOT NULL THEN
          v_excluidos := array_append(v_excluidos, v_membro_pregacao);
        END IF;

        SELECT membro_id INTO v_membro_som
        FROM buscar_membros_disponiveis('som', v_data_culto, p_igreja_id, v_excluidos)
        LIMIT 1;
        IF v_membro_som IS NOT NULL THEN
          v_excluidos := array_append(v_excluidos, v_membro_som);
        END IF;

        SELECT membro_id INTO v_membro_recepcao
        FROM buscar_membros_disponiveis('recepcao', v_data_culto, p_igreja_id, v_excluidos)
        LIMIT 1;
        IF v_membro_recepcao IS NOT NULL THEN
          v_excluidos := array_append(v_excluidos, v_membro_recepcao);
        END IF;

        SELECT membro_id INTO v_membro_midia
        FROM buscar_membros_disponiveis('midia', v_data_culto, p_igreja_id, v_excluidos)
        LIMIT 1;
        IF v_membro_midia IS NOT NULL THEN
          v_excluidos := array_append(v_excluidos, v_membro_midia);
        END IF;

        SELECT membro_id INTO v_membro_infantil
        FROM buscar_membros_disponiveis('infantil', v_data_culto, p_igreja_id, v_excluidos)
        LIMIT 1;

        INSERT INTO escalas_detalhes (
          escala_id, data_culto, dia_semana, horario, tipo_culto,
          membro_oracao_id, membro_louvor_id, membro_pregacao_id,
          membro_som_id, membro_recepcao_id, membro_midia_id, membro_infantil_id
        ) VALUES (
          v_escala_id, v_data_culto, v_culto.dia_semana, v_culto.horario, v_culto.tipo,
          v_membro_oracao, v_membro_louvor, v_membro_pregacao,
          v_membro_som, v_membro_recepcao, v_membro_midia, v_membro_infantil
        );

      END IF;
      v_data_culto := v_data_culto + interval '1 day';
    END LOOP;
  END LOOP;

  RETURN v_escala_id;
END;
$$ LANGUAGE plpgsql;
