-- =============================================
-- FUNÇÕES AUXILIARES DO SISTEMA
-- =============================================

-- =============================================
-- 1. FUNÇÃO PARA BUSCAR MEMBROS DISPONÍVEIS PARA ESCALA
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
        WHEN p_funcao = 'oracao' THEN ed.membro_oracao_id
        WHEN p_funcao = 'louvor' THEN ed.membro_louvor_id
        WHEN p_funcao = 'pregacao' THEN ed.membro_pregacao_id
        WHEN p_funcao = 'som' THEN ed.membro_som_id
        WHEN p_funcao = 'recepcao' THEN ed.membro_recepcao_id
        WHEN p_funcao = 'midia' THEN ed.membro_midia_id
        WHEN p_funcao = 'infantil' THEN ed.membro_infantil_id
      END as membro_id_escalado,
      ed.data_culto
    FROM escalas_detalhes ed
    JOIN escalas e ON e.id = ed.escala_id
    WHERE e.igreja_id = p_igreja_id
      AND ed.data_culto <= p_data_culto
      AND e.status IN ('finalizada', 'enviada')
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
    -- Verificar disponibilidade no dia da semana
    AND (
      m.disponibilidade IS NULL OR
      m.disponibilidade->'dias' @> to_jsonb(EXTRACT(DOW FROM p_data_culto)::INT)
    )
  GROUP BY m.id, m.nome, mf.nivel
  ORDER BY
    -- Priorizar quem tem menos escalações no mês
    total_escalacoes_mes ASC,
    -- Depois quem não foi escalado há mais tempo
    ultima_escalacao ASC NULLS FIRST,
    -- Por último, nível de experiência
    CASE mf.nivel
      WHEN 'avancado' THEN 1
      WHEN 'intermediario' THEN 2
      WHEN 'iniciante' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 2. FUNÇÃO PARA GERAR ESCALA AUTOMATICAMENTE
-- =============================================

CREATE OR REPLACE FUNCTION gerar_escala_automatica(
  p_mes INT,
  p_ano INT,
  p_igreja_id UUID,
  p_created_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_escala_id UUID;
  v_culto RECORD;
  v_data_culto DATE;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_membro_oracao UUID;
  v_membro_louvor UUID;
  v_membro_pregacao UUID;
  v_membro_som UUID;
  v_membro_recepcao UUID;
  v_membro_midia UUID;
  v_membro_infantil UUID;
BEGIN
  -- Criar registro da escala
  INSERT INTO escalas (mes, ano, igreja_id, status, created_by)
  VALUES (p_mes, p_ano, p_igreja_id, 'rascunho', p_created_by)
  RETURNING id INTO v_escala_id;

  -- Calcular primeiro e último dia do mês
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::DATE;

  -- Para cada culto regular da igreja
  FOR v_culto IN
    SELECT * FROM cultos_regulares
    WHERE igreja_id = p_igreja_id AND ativo = TRUE
  LOOP
    -- Para cada data do mês que corresponde ao dia da semana do culto
    v_data_culto := v_data_inicio;
    WHILE v_data_culto <= v_data_fim LOOP
      IF EXTRACT(DOW FROM v_data_culto) = v_culto.dia_semana THEN
        -- Buscar membros disponíveis para cada função
        SELECT membro_id INTO v_membro_oracao
        FROM buscar_membros_disponiveis('oracao', v_data_culto, p_igreja_id)
        LIMIT 1;

        SELECT membro_id INTO v_membro_louvor
        FROM buscar_membros_disponiveis('louvor', v_data_culto, p_igreja_id)
        LIMIT 1;

        SELECT membro_id INTO v_membro_pregacao
        FROM buscar_membros_disponiveis('pregacao', v_data_culto, p_igreja_id)
        LIMIT 1;

        SELECT membro_id INTO v_membro_som
        FROM buscar_membros_disponiveis('som', v_data_culto, p_igreja_id)
        LIMIT 1;

        SELECT membro_id INTO v_membro_recepcao
        FROM buscar_membros_disponiveis('recepcao', v_data_culto, p_igreja_id)
        LIMIT 1;

        SELECT membro_id INTO v_membro_midia
        FROM buscar_membros_disponiveis('midia', v_data_culto, p_igreja_id)
        LIMIT 1;

        SELECT membro_id INTO v_membro_infantil
        FROM buscar_membros_disponiveis('infantil', v_data_culto, p_igreja_id)
        LIMIT 1;

        -- Inserir detalhes da escala
        INSERT INTO escalas_detalhes (
          escala_id,
          data_culto,
          dia_semana,
          horario,
          tipo_culto,
          membro_oracao_id,
          membro_louvor_id,
          membro_pregacao_id,
          membro_som_id,
          membro_recepcao_id,
          membro_midia_id,
          membro_infantil_id
        ) VALUES (
          v_escala_id,
          v_data_culto,
          v_culto.dia_semana,
          v_culto.horario,
          v_culto.tipo,
          v_membro_oracao,
          v_membro_louvor,
          v_membro_pregacao,
          v_membro_som,
          v_membro_recepcao,
          v_membro_midia,
          v_membro_infantil
        );
      END IF;

      v_data_culto := v_data_culto + interval '1 day';
    END LOOP;
  END LOOP;

  RETURN v_escala_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. FUNÇÃO PARA REESCALAR MEMBRO
-- =============================================

CREATE OR REPLACE FUNCTION reescalar_membro(
  p_detalhe_escala_id UUID,
  p_funcao TEXT
)
RETURNS UUID AS $$
DECLARE
  v_detalhe RECORD;
  v_novo_membro_id UUID;
  v_membros_excluir UUID[];
BEGIN
  -- Buscar detalhes atuais
  SELECT * INTO v_detalhe
  FROM escalas_detalhes
  WHERE id = p_detalhe_escala_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Detalhe de escala não encontrado';
  END IF;

  -- Montar lista de membros a excluir (todos os já escalados neste culto)
  v_membros_excluir := ARRAY[
    v_detalhe.membro_oracao_id,
    v_detalhe.membro_louvor_id,
    v_detalhe.membro_pregacao_id,
    v_detalhe.membro_som_id,
    v_detalhe.membro_recepcao_id,
    v_detalhe.membro_midia_id,
    v_detalhe.membro_infantil_id
  ];

  -- Buscar novo membro disponível
  SELECT membro_id INTO v_novo_membro_id
  FROM buscar_membros_disponiveis(
    p_funcao,
    v_detalhe.data_culto,
    (SELECT igreja_id FROM escalas WHERE id = v_detalhe.escala_id),
    v_membros_excluir
  )
  LIMIT 1;

  IF v_novo_membro_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum membro disponível encontrado para a função %', p_funcao;
  END IF;

  -- Atualizar escala com novo membro
  CASE p_funcao
    WHEN 'oracao' THEN
      UPDATE escalas_detalhes
      SET membro_oracao_id = v_novo_membro_id,
          status_confirmacao_oracao = 'pendente'
      WHERE id = p_detalhe_escala_id;
    WHEN 'louvor' THEN
      UPDATE escalas_detalhes
      SET membro_louvor_id = v_novo_membro_id,
          status_confirmacao_louvor = 'pendente'
      WHERE id = p_detalhe_escala_id;
    WHEN 'pregacao' THEN
      UPDATE escalas_detalhes
      SET membro_pregacao_id = v_novo_membro_id,
          status_confirmacao_pregacao = 'pendente'
      WHERE id = p_detalhe_escala_id;
    WHEN 'som' THEN
      UPDATE escalas_detalhes
      SET membro_som_id = v_novo_membro_id,
          status_confirmacao_som = 'pendente'
      WHERE id = p_detalhe_escala_id;
    WHEN 'recepcao' THEN
      UPDATE escalas_detalhes
      SET membro_recepcao_id = v_novo_membro_id,
          status_confirmacao_recepcao = 'pendente'
      WHERE id = p_detalhe_escala_id;
    WHEN 'midia' THEN
      UPDATE escalas_detalhes
      SET membro_midia_id = v_novo_membro_id,
          status_confirmacao_midia = 'pendente'
      WHERE id = p_detalhe_escala_id;
    WHEN 'infantil' THEN
      UPDATE escalas_detalhes
      SET membro_infantil_id = v_novo_membro_id,
          status_confirmacao_infantil = 'pendente'
      WHERE id = p_detalhe_escala_id;
  END CASE;

  RETURN v_novo_membro_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. FUNÇÃO PARA ESTATÍSTICAS FINANCEIRAS
-- =============================================

CREATE OR REPLACE FUNCTION estatisticas_financeiras(
  p_igreja_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE (
  total_entradas NUMERIC,
  total_saidas NUMERIC,
  saldo NUMERIC,
  total_dizimos NUMERIC,
  total_ofertas NUMERIC,
  categoria_maior_gasto TEXT,
  valor_maior_gasto NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'efetivado'), 0) as entradas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND status = 'efetivado'), 0) as saidas,
      COALESCE(SUM(valor) FILTER (
        WHERE tipo = 'entrada'
        AND status = 'efetivado'
        AND categoria_id IN (SELECT id FROM categorias_financeiras WHERE nome = 'Dízimos')
      ), 0) as dizimos,
      COALESCE(SUM(valor) FILTER (
        WHERE tipo = 'entrada'
        AND status = 'efetivado'
        AND categoria_id IN (SELECT id FROM categorias_financeiras WHERE nome = 'Ofertas')
      ), 0) as ofertas
    FROM lancamentos_financeiros
    WHERE igreja_id = p_igreja_id
      AND data BETWEEN p_data_inicio AND p_data_fim
  ),
  maior_gasto AS (
    SELECT
      c.nome,
      SUM(l.valor) as total
    FROM lancamentos_financeiros l
    JOIN categorias_financeiras c ON c.id = l.categoria_id
    WHERE l.igreja_id = p_igreja_id
      AND l.data BETWEEN p_data_inicio AND p_data_fim
      AND l.tipo = 'saida'
      AND l.status = 'efetivado'
    GROUP BY c.nome
    ORDER BY total DESC
    LIMIT 1
  )
  SELECT
    s.entradas,
    s.saidas,
    s.entradas - s.saidas as saldo,
    s.dizimos,
    s.ofertas,
    mg.nome,
    mg.total
  FROM stats s
  LEFT JOIN maior_gasto mg ON TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. FUNÇÃO PARA GERAR LANÇAMENTOS RECORRENTES
-- =============================================

CREATE OR REPLACE FUNCTION gerar_lancamentos_recorrentes(
  p_mes INT,
  p_ano INT
)
RETURNS INT AS $$
DECLARE
  v_despesa RECORD;
  v_data_vencimento DATE;
  v_count INT := 0;
BEGIN
  FOR v_despesa IN
    SELECT * FROM despesas_recorrentes
    WHERE ativo = TRUE
    AND (data_fim IS NULL OR make_date(p_ano, p_mes, 1) <= data_fim)
    AND make_date(p_ano, p_mes, 1) >= data_inicio
  LOOP
    -- Calcular data de vencimento
    v_data_vencimento := make_date(
      p_ano,
      p_mes,
      LEAST(v_despesa.dia_vencimento, EXTRACT(DAY FROM (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day'))::INT)
    );

    -- Verificar se já não existe lançamento para este mês
    IF NOT EXISTS (
      SELECT 1 FROM lancamentos_financeiros
      WHERE igreja_id = v_despesa.igreja_id
      AND categoria_id = v_despesa.categoria_id
      AND fornecedor = v_despesa.fornecedor
      AND EXTRACT(YEAR FROM data_vencimento) = p_ano
      AND EXTRACT(MONTH FROM data_vencimento) = p_mes
      AND recorrente = TRUE
    ) THEN
      -- Criar lançamento
      INSERT INTO lancamentos_financeiros (
        data,
        tipo,
        categoria_id,
        valor,
        forma_pagamento,
        conta_bancaria_id,
        igreja_id,
        fornecedor,
        descricao,
        status,
        data_vencimento,
        recorrente,
        created_by
      ) VALUES (
        v_data_vencimento,
        'saida',
        v_despesa.categoria_id,
        v_despesa.valor,
        'boleto',
        v_despesa.conta_bancaria_id,
        v_despesa.igreja_id,
        v_despesa.fornecedor,
        v_despesa.nome || ' - ' || to_char(v_data_vencimento, 'MM/YYYY'),
        'agendado',
        v_data_vencimento,
        TRUE,
        (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1) -- Sistema
      );

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. FUNÇÃO PARA CALCULAR FREQUÊNCIA DE MEMBRO
-- =============================================

CREATE OR REPLACE FUNCTION calcular_frequencia_membro(
  p_membro_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE (
  total_cultos INT,
  presencas INT,
  faltas INT,
  percentual NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT as total_cultos,
    COUNT(*) FILTER (WHERE presente = TRUE)::INT as presencas,
    COUNT(*) FILTER (WHERE presente = FALSE)::INT as faltas,
    ROUND(
      (COUNT(*) FILTER (WHERE presente = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100),
      2
    ) as percentual
  FROM frequencias
  WHERE membro_id = p_membro_id
    AND data BETWEEN p_data_inicio AND p_data_fim;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FIM DAS FUNÇÕES AUXILIARES
-- =============================================
