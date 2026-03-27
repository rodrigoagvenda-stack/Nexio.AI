-- ============================================================
-- SEED: Membros Fake para Teste — IPVB Sistema
-- ============================================================
-- INSTRUÇÕES:
--   1. Execute no SQL Editor do Supabase
--   2. Substitua o valor de v_igreja_id pelo ID real da sua igreja
--      (veja em: SELECT id, nome FROM igrejas LIMIT 5)
--   3. O script cria: 20 membros, funções na escala e cultos regulares
-- ============================================================

DO $$
DECLARE
  v_igreja_id UUID;

  -- IDs dos membros
  m01 UUID := gen_random_uuid();
  m02 UUID := gen_random_uuid();
  m03 UUID := gen_random_uuid();
  m04 UUID := gen_random_uuid();
  m05 UUID := gen_random_uuid();
  m06 UUID := gen_random_uuid();
  m07 UUID := gen_random_uuid();
  m08 UUID := gen_random_uuid();
  m09 UUID := gen_random_uuid();
  m10 UUID := gen_random_uuid();
  m11 UUID := gen_random_uuid();
  m12 UUID := gen_random_uuid();
  m13 UUID := gen_random_uuid();
  m14 UUID := gen_random_uuid();
  m15 UUID := gen_random_uuid();
  m16 UUID := gen_random_uuid();
  m17 UUID := gen_random_uuid();
  m18 UUID := gen_random_uuid();
  m19 UUID := gen_random_uuid();
  m20 UUID := gen_random_uuid();

BEGIN
  -- ── Pega a primeira igreja cadastrada ──────────────────────────
  SELECT id INTO v_igreja_id FROM igrejas LIMIT 1;

  IF v_igreja_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma igreja encontrada. Cadastre uma igreja primeiro.';
  END IF;

  RAISE NOTICE 'Usando igreja_id: %', v_igreja_id;

  -- ── Cultos Regulares (para geração automática funcionar) ───────
  INSERT INTO cultos_regulares (id, igreja_id, nome, dia_semana, horario, tipo, ativo) VALUES
    (gen_random_uuid(), v_igreja_id, 'Culto de Domingo Manhã',   0, '09:00', 'domingo',   TRUE),
    (gen_random_uuid(), v_igreja_id, 'Culto de Domingo Noite',   0, '19:00', 'domingo',   TRUE),
    (gen_random_uuid(), v_igreja_id, 'Culto de Quarta-Feira',    3, '19:30', 'semana',    TRUE),
    (gen_random_uuid(), v_igreja_id, 'Culto de Sexta-Feira',     5, '19:30', 'semana',    TRUE)
  ON CONFLICT DO NOTHING;

  -- ── Membros ───────────────────────────────────────────────────
  INSERT INTO membros (id, nome, email, telefone, data_nascimento, sexo, estado_civil,
                       cargo, dizimista, igreja_id, data_batismo, data_entrada, status,
                       disponibilidade) VALUES

    -- Pastores / Liderança
    (m01, 'Rev. Marcos Ferreira Silva',    'marcos.pastor@ipvb.com',    '(11) 99001-0001',
     '1975-03-14', 'M', 'casado',    'Pastor',         TRUE, v_igreja_id, '1998-06-15', '2010-01-01', 'ativo',
     '{"dias":[0,3,5],"horarios":["manha","noite"]}'),

    (m02, 'Pr. Daniel Costa Oliveira',     'daniel.presbiter@ipvb.com', '(11) 99001-0002',
     '1982-07-22', 'M', 'casado',    'Presbítero',     TRUE, v_igreja_id, '2000-04-10', '2012-03-15', 'ativo',
     '{"dias":[0,3,5],"horarios":["manha","noite"]}'),

    (m03, 'Dc. Roberto Alves Mendes',      'roberto.diacono@ipvb.com',  '(11) 99001-0003',
     '1979-11-05', 'M', 'casado',    'Diácono',        TRUE, v_igreja_id, '2001-08-20', '2011-06-01', 'ativo',
     '{"dias":[0,5],"horarios":["manha","noite"]}'),

    -- Louvor / Música
    (m04, 'Júlia Nascimento Santos',       'julia.louvor@gmail.com',    '(11) 99001-0004',
     '1995-02-18', 'F', 'solteiro',  'Líder de Louvor', TRUE, v_igreja_id, '2012-11-30', '2014-02-01', 'ativo',
     '{"dias":[0,3,5],"horarios":["noite"]}'),

    (m05, 'Thiago Rodrigues Lima',         'thiago.musico@gmail.com',   '(11) 99001-0005',
     '1997-08-30', 'M', 'solteiro',  'Músico',         FALSE, v_igreja_id, '2015-01-18', '2015-03-01', 'ativo',
     '{"dias":[0,3,5],"horarios":["noite"]}'),

    (m06, 'Ana Beatriz Carvalho',          'anabeatriz@gmail.com',      '(11) 99001-0006',
     '1999-04-25', 'F', 'solteiro',  'Vocalista',      TRUE, v_igreja_id, '2016-06-05', '2016-07-01', 'ativo',
     '{"dias":[0,5],"horarios":["noite"]}'),

    (m07, 'Lucas Pereira Gomes',           'lucas.guitarrista@gmail.com','(11) 99001-0007',
     '2001-12-10', 'M', 'solteiro',  'Guitarrista',    FALSE, v_igreja_id, '2018-03-25', '2018-04-01', 'ativo',
     '{"dias":[0,3],"horarios":["noite"]}'),

    -- Oração / Intercessão
    (m08, 'Dona Maria Aparecida Costa',    'maria.oracao@gmail.com',    '(11) 99001-0008',
     '1958-09-12', 'F', 'viuvo',     'Intercessora',   TRUE, v_igreja_id, '1995-05-20', '2009-01-01', 'ativo',
     '{"dias":[0,3,5],"horarios":["manha","noite"]}'),

    (m09, 'Antônio José Ferreira',         'antonio.oracao@gmail.com',  '(11) 99001-0009',
     '1961-06-28', 'M', 'casado',    'Intercessor',    TRUE, v_igreja_id, '1997-10-12', '2010-05-01', 'ativo',
     '{"dias":[0,5],"horarios":["manha","noite"]}'),

    (m10, 'Sra. Rosa de Lima Batista',     'rosa.oracao@gmail.com',     '(11) 99001-0010',
     '1965-01-08', 'F', 'casado',    'Intercessora',   TRUE, v_igreja_id, '2000-12-31', '2013-02-01', 'ativo',
     '{"dias":[0,3],"horarios":["manha"]}'),

    -- Som / Mídia
    (m11, 'Felipe Souza Barbosa',          'felipe.som@gmail.com',      '(11) 99001-0011',
     '1993-05-17', 'M', 'solteiro',  'Técnico de Som', FALSE, v_igreja_id, '2010-07-04', '2011-01-15', 'ativo',
     '{"dias":[0,3,5],"horarios":["noite"]}'),

    (m12, 'Camila Rocha Teixeira',         'camila.midia@gmail.com',    '(11) 99001-0012',
     '1998-10-03', 'F', 'solteiro',  'Mídia Social',   TRUE, v_igreja_id, '2015-09-13', '2016-01-01', 'ativo',
     '{"dias":[0,5],"horarios":["noite"]}'),

    -- Recepção / Portaria
    (m13, 'Patrícia Lima Fonseca',         'patricia.recepcao@gmail.com','(11) 99001-0013',
     '1985-03-22', 'F', 'casado',    'Recepcionista',  TRUE, v_igreja_id, '2005-04-17', '2007-03-01', 'ativo',
     '{"dias":[0,3,5],"horarios":["manha","noite"]}'),

    (m14, 'Carlos Eduardo Martins',        'carlos.porteiro@gmail.com', '(11) 99001-0014',
     '1988-11-14', 'M', 'casado',    'Recepcionista',  TRUE, v_igreja_id, '2008-02-24', '2009-06-01', 'ativo',
     '{"dias":[0,5],"horarios":["manha","noite"]}'),

    (m15, 'Viviane Almeida Santos',        'viviane.portaria@gmail.com','(11) 99001-0015',
     '1991-07-09', 'F', 'solteiro',  'Recepcionista',  FALSE, v_igreja_id, '2012-05-06', '2013-01-01', 'ativo',
     '{"dias":[0,3],"horarios":["noite"]}'),

    -- Ministério Infantil
    (m16, 'Sandra Regina Oliveira',        'sandra.infantil@gmail.com', '(11) 99001-0016',
     '1980-08-16', 'F', 'casado',    'Professora Inf.', TRUE, v_igreja_id, '2002-06-29', '2006-09-01', 'ativo',
     '{"dias":[0],"horarios":["manha","noite"]}'),

    (m17, 'Fernanda Cruz Azevedo',         'fernanda.infantil@gmail.com','(11) 99001-0017',
     '1987-02-11', 'F', 'casado',    'Professora Inf.', TRUE, v_igreja_id, '2006-11-19', '2008-01-01', 'ativo',
     '{"dias":[0],"horarios":["manha","noite"]}'),

    -- Membros Gerais (aniversariantes deste mês para testar dashboard)
    (m18, 'Bruno Rafael Moreira',          'bruno.membro@gmail.com',    '(11) 99001-0018',
     '1996-03-05', 'M', 'solteiro',  'Membro',         FALSE, v_igreja_id, '2018-08-11', '2019-01-01', 'ativo',
     '{"dias":[0],"horarios":["noite"]}'),

    (m19, 'Letícia Moura Cardoso',         'leticia.membro@gmail.com',  '(11) 99001-0019',
     '2000-03-19', 'F', 'solteiro',  'Membro',         FALSE, v_igreja_id, '2019-02-03', '2019-03-01', 'ativo',
     '{"dias":[0,5],"horarios":["noite"]}'),

    (m20, 'Eduardo Pinheiro Ramos',        'eduardo.membro@gmail.com',  '(11) 99001-0020',
     '1990-03-27', 'M', 'casado',    'Membro',         TRUE, v_igreja_id, '2009-04-12', '2010-01-01', 'ativo',
     '{"dias":[0,3,5],"horarios":["manha","noite"]}')
  ;

  -- ── Funções na Escala (membros_funcoes) ───────────────────────
  -- Pregação
  INSERT INTO membros_funcoes (membro_id, funcao, nivel, ativo) VALUES
    (m01, 'pregacao', 'avancado',     TRUE),
    (m02, 'pregacao', 'avancado',     TRUE),
    (m03, 'pregacao', 'intermediario',TRUE)
  ON CONFLICT (membro_id, funcao) DO NOTHING;

  -- Oração
  INSERT INTO membros_funcoes (membro_id, funcao, nivel, ativo) VALUES
    (m08, 'oracao', 'avancado',      TRUE),
    (m09, 'oracao', 'avancado',      TRUE),
    (m10, 'oracao', 'intermediario', TRUE),
    (m02, 'oracao', 'avancado',      TRUE),
    (m20, 'oracao', 'iniciante',     TRUE)
  ON CONFLICT (membro_id, funcao) DO NOTHING;

  -- Louvor
  INSERT INTO membros_funcoes (membro_id, funcao, nivel, ativo) VALUES
    (m04, 'louvor', 'avancado',      TRUE),
    (m05, 'louvor', 'intermediario', TRUE),
    (m06, 'louvor', 'intermediario', TRUE),
    (m07, 'louvor', 'iniciante',     TRUE)
  ON CONFLICT (membro_id, funcao) DO NOTHING;

  -- Som
  INSERT INTO membros_funcoes (membro_id, funcao, nivel, ativo) VALUES
    (m11, 'som', 'avancado',         TRUE),
    (m05, 'som', 'intermediario',    TRUE)
  ON CONFLICT (membro_id, funcao) DO NOTHING;

  -- Mídia
  INSERT INTO membros_funcoes (membro_id, funcao, nivel, ativo) VALUES
    (m12, 'midia', 'avancado',       TRUE),
    (m11, 'midia', 'intermediario',  TRUE)
  ON CONFLICT (membro_id, funcao) DO NOTHING;

  -- Recepção
  INSERT INTO membros_funcoes (membro_id, funcao, nivel, ativo) VALUES
    (m13, 'recepcao', 'avancado',    TRUE),
    (m14, 'recepcao', 'avancado',    TRUE),
    (m15, 'recepcao', 'intermediario',TRUE)
  ON CONFLICT (membro_id, funcao) DO NOTHING;

  -- Ministério Infantil
  INSERT INTO membros_funcoes (membro_id, funcao, nivel, ativo) VALUES
    (m16, 'infantil', 'avancado',    TRUE),
    (m17, 'infantil', 'avancado',    TRUE)
  ON CONFLICT (membro_id, funcao) DO NOTHING;

  -- ── Pedidos de oração ativos (para testar dashboard) ─────────
  INSERT INTO pedidos_oracao (membro_id, titulo, descricao, categoria, privacidade, status, data_pedido) VALUES
    (m08, 'Cura da filha',           'Minha filha está doente há semanas, pedindo oração pela cura.', 'saude',    'lideranca', 'ativo',     NOW() - INTERVAL '3 days'),
    (m18, 'Emprego novo',            'Estou buscando uma nova oportunidade de trabalho.',             'trabalho', 'publico',   'ativo',     NOW() - INTERVAL '5 days'),
    (m20, 'Restauração do casamento','Passando por um momento difícil no casamento.',                 'familia',  'lideranca', 'ativo',     NOW() - INTERVAL '1 day'),
    (m04, 'Provisão financeira',     'Precisando de provisão para fechar as contas do mês.',         'financeiro','lideranca','ativo',     NOW() - INTERVAL '7 days'),
    (m19, 'Crescimento espiritual',  'Pedindo por mais fervor e intimidade com Deus.',               'espiritual','publico',  'respondido', NOW() - INTERVAL '15 days')
  ;

  -- ── Lançamentos financeiros (para testar financeiro) ─────────
  -- Pega a primeira categoria de entrada e saída
  INSERT INTO lancamentos_financeiros
    (igreja_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, status)
  SELECT
    v_igreja_id,
    CURRENT_DATE - INTERVAL '2 days',
    'entrada',
    id,
    'Dízimos — Culto Domingo 23/03',
    3850.00,
    'pix',
    'efetivado'
  FROM categorias_financeiras WHERE nome = 'Dízimos' LIMIT 1;

  INSERT INTO lancamentos_financeiros
    (igreja_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, status)
  SELECT
    v_igreja_id,
    CURRENT_DATE - INTERVAL '2 days',
    'entrada',
    id,
    'Ofertas — Culto Domingo 23/03',
    1240.50,
    'dinheiro',
    'efetivado'
  FROM categorias_financeiras WHERE nome = 'Ofertas' LIMIT 1;

  INSERT INTO lancamentos_financeiros
    (igreja_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, status)
  SELECT
    v_igreja_id,
    CURRENT_DATE - INTERVAL '5 days',
    'entrada',
    id,
    'Dízimos — Culto Domingo 16/03',
    2980.00,
    'pix',
    'efetivado'
  FROM categorias_financeiras WHERE nome = 'Dízimos' LIMIT 1;

  INSERT INTO lancamentos_financeiros
    (igreja_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, status)
  SELECT
    v_igreja_id,
    CURRENT_DATE - INTERVAL '10 days',
    'saida',
    id,
    'Conta de Luz — Março 2026',
    487.30,
    'pix',
    'efetivado'
  FROM categorias_financeiras WHERE nome = 'Luz' LIMIT 1;

  INSERT INTO lancamentos_financeiros
    (igreja_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, status)
  SELECT
    v_igreja_id,
    CURRENT_DATE - INTERVAL '12 days',
    'saida',
    id,
    'Aluguel — Março 2026',
    2200.00,
    'transferencia',
    'efetivado'
  FROM categorias_financeiras WHERE nome = 'Aluguel' LIMIT 1;

  INSERT INTO lancamentos_financeiros
    (igreja_id, data, tipo, categoria_id, descricao, valor, forma_pagamento, status)
  SELECT
    v_igreja_id,
    CURRENT_DATE - INTERVAL '8 days',
    'saida',
    id,
    'Material de Limpeza — Março',
    156.80,
    'dinheiro',
    'efetivado'
  FROM categorias_financeiras WHERE nome = 'Material de Limpeza' LIMIT 1;

  RAISE NOTICE '✅ Seed concluído com sucesso!';
  RAISE NOTICE '   → 20 membros criados';
  RAISE NOTICE '   → 4 cultos regulares (Dom manhã, Dom noite, Qua, Sex)';
  RAISE NOTICE '   → Funções de escala atribuídas (oracao, louvor, pregacao, som, midia, recepcao, infantil)';
  RAISE NOTICE '   → 5 pedidos de oração';
  RAISE NOTICE '   → 6 lançamentos financeiros do mês';
  RAISE NOTICE '   → 3 aniversariantes em março (m18, m19, m20)';
  RAISE NOTICE '';
  RAISE NOTICE '➡️  Agora vá em Escalas → Nova Escala e gere Abril/2026 automaticamente!';

END $$;
