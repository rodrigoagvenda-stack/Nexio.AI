-- ============================================================
-- IPVB SISTEMA - SETUP COMPLETO DE PRODUÇÃO
-- Igreja Pentecostal Vale da Bênção
-- Versão: 1.0 | Pronto para produção
--
-- INSTRUÇÕES:
-- 1. Cole este script no SQL Editor do Supabase (novo projeto)
-- 2. Execute uma única vez
-- 3. Crie o primeiro usuário admin pelo Supabase Auth Dashboard
-- 4. Execute o bloco de PRIMEIRO ADMIN ao final
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SEÇÃO 1: TABELAS
-- ============================================================

-- 1.1 PROFILES (vinculado ao auth.users do Supabase)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  nome        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'secretaria'
                CHECK (role IN ('admin', 'pastor', 'tesoureiro', 'secretaria', 'lider_ministerio')),
  igreja_id   UUID,
  telefone    TEXT,
  foto_url    TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 IGREJAS
CREATE TABLE igrejas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('sede', 'congregacao')),
  endereco        JSONB,
  responsavel_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  telefone        TEXT,
  email           TEXT,
  capacidade      INT CHECK (capacidade > 0),
  logo_url        TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK de profiles para igrejas (criada após igrejas existir)
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_igreja
  FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE SET NULL;

-- 1.3 CULTOS REGULARES
CREATE TABLE cultos_regulares (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  igreja_id   UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  dia_semana  INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 6=Sáb
  horario     TIME NOT NULL,
  tipo        TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 MEMBROS
CREATE TABLE membros (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome             TEXT NOT NULL,
  cpf              TEXT UNIQUE,
  email            TEXT,
  telefone         TEXT,
  data_nascimento  DATE,
  sexo             TEXT CHECK (sexo IN ('M', 'F')),
  endereco         JSONB,
  estado_civil     TEXT CHECK (estado_civil IN ('solteiro', 'casado', 'viuvo', 'divorciado')),
  foto_url         TEXT,
  cargo            TEXT,
  dizimista        BOOLEAN NOT NULL DEFAULT FALSE,
  igreja_id        UUID NOT NULL REFERENCES igrejas(id) ON DELETE RESTRICT,
  data_batismo     DATE,
  data_entrada     DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'inativo', 'visitante')),
  disponibilidade  JSONB, -- {"dias": [0,1,3,5], "horarios": ["manha","tarde","noite"]}
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 MEMBROS FUNÇÕES
CREATE TABLE membros_funcoes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membro_id   UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  funcao      TEXT NOT NULL
              CHECK (funcao IN ('oracao', 'louvor', 'pregacao', 'som', 'recepcao', 'midia', 'infantil')),
  nivel       TEXT CHECK (nivel IN ('iniciante', 'intermediario', 'avancado')),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (membro_id, funcao)
);

-- 1.6 MINISTÉRIOS
CREATE TABLE ministerios (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  lider_id    UUID REFERENCES membros(id) ON DELETE SET NULL,
  igreja_id   UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  cor         TEXT NOT NULL DEFAULT '#085832',
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 MINISTÉRIOS MEMBROS
CREATE TABLE ministerios_membros (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ministerio_id  UUID NOT NULL REFERENCES ministerios(id) ON DELETE CASCADE,
  membro_id      UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  funcao         TEXT,
  data_entrada   DATE NOT NULL DEFAULT CURRENT_DATE,
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ministerio_id, membro_id)
);

-- 1.8 ESCALAS
CREATE TABLE escalas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mes               INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano               INT NOT NULL CHECK (ano >= 2020),
  igreja_id         UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'rascunho'
                    CHECK (status IN ('rascunho', 'confirmando', 'finalizada', 'enviada')),
  pdf_url           TEXT,
  data_geracao      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_finalizacao  TIMESTAMPTZ,
  data_envio        TIMESTAMPTZ,
  created_by        UUID NOT NULL REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mes, ano, igreja_id)
);

-- 1.9 ESCALAS DETALHES
CREATE TABLE escalas_detalhes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escala_id    UUID NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
  data_culto   DATE NOT NULL,
  dia_semana   INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario      TIME NOT NULL,
  tipo_culto   TEXT,

  -- Membros escalados
  membro_oracao_id    UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_louvor_id    UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_pregacao_id  UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_som_id       UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_recepcao_id  UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_midia_id     UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_infantil_id  UUID REFERENCES membros(id) ON DELETE SET NULL,

  -- Status de confirmação
  status_confirmacao_oracao    TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao_oracao IN ('pendente', 'confirmado', 'recusado')),
  status_confirmacao_louvor    TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao_louvor IN ('pendente', 'confirmado', 'recusado')),
  status_confirmacao_pregacao  TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao_pregacao IN ('pendente', 'confirmado', 'recusado')),
  status_confirmacao_som       TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao_som IN ('pendente', 'confirmado', 'recusado')),
  status_confirmacao_recepcao  TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao_recepcao IN ('pendente', 'confirmado', 'recusado')),
  status_confirmacao_midia     TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao_midia IN ('pendente', 'confirmado', 'recusado')),
  status_confirmacao_infantil  TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status_confirmacao_infantil IN ('pendente', 'confirmado', 'recusado')),

  observacoes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.10 FREQUÊNCIAS
CREATE TABLE frequencias (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membro_id   UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  igreja_id   UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  tipo_culto  TEXT,
  presente    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (membro_id, data, tipo_culto)
);

-- 1.11 CATEGORIAS FINANCEIRAS
CREATE TABLE categorias_financeiras (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  cor         TEXT NOT NULL DEFAULT '#085832',
  icone       TEXT,
  descricao   TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.12 CONTAS BANCÁRIAS
CREATE TABLE contas_bancarias (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome           TEXT NOT NULL,
  banco          TEXT,
  agencia        TEXT,
  conta          TEXT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'caixa')),
  saldo_inicial  NUMERIC(15,2) NOT NULL DEFAULT 0,
  saldo_atual    NUMERIC(15,2) NOT NULL DEFAULT 0,
  igreja_id      UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.13 LANÇAMENTOS FINANCEIROS
CREATE TABLE lancamentos_financeiros (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data                DATE NOT NULL,
  tipo                TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria_id        UUID NOT NULL REFERENCES categorias_financeiras(id),
  valor               NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  forma_pagamento     TEXT NOT NULL
                      CHECK (forma_pagamento IN ('dinheiro','pix','transferencia','debito','credito','boleto','cheque')),
  conta_bancaria_id   UUID REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  igreja_id           UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  membro_id           UUID REFERENCES membros(id) ON DELETE SET NULL,
  fornecedor          TEXT,
  descricao           TEXT NOT NULL,
  comprovante_url     TEXT,
  status              TEXT NOT NULL DEFAULT 'efetivado'
                      CHECK (status IN ('efetivado', 'pendente', 'agendado', 'cancelado')),
  data_vencimento     DATE,
  data_pagamento      DATE,

  -- Parcelamento
  parcelado           BOOLEAN NOT NULL DEFAULT FALSE,
  numero_parcelas     INT CHECK (numero_parcelas > 0),
  parcela_atual       INT CHECK (parcela_atual > 0),
  lancamento_pai_id   UUID REFERENCES lancamentos_financeiros(id) ON DELETE CASCADE,

  -- Recorrência e conciliação
  recorrente          BOOLEAN NOT NULL DEFAULT FALSE,
  conciliado          BOOLEAN NOT NULL DEFAULT FALSE,
  data_conciliacao    TIMESTAMPTZ,

  observacoes  TEXT,
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.14 DESPESAS RECORRENTES
CREATE TABLE despesas_recorrentes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome              TEXT NOT NULL,
  categoria_id      UUID NOT NULL REFERENCES categorias_financeiras(id),
  valor             NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  dia_vencimento    INT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  conta_bancaria_id UUID REFERENCES contas_bancarias(id) ON DELETE SET NULL,
  fornecedor        TEXT,
  igreja_id         UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  ativo             BOOLEAN NOT NULL DEFAULT TRUE,
  data_inicio       DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim          DATE,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.15 ORÇAMENTO
CREATE TABLE orcamento (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ano             INT NOT NULL CHECK (ano >= 2020),
  mes             INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  igreja_id       UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  categoria_id    UUID NOT NULL REFERENCES categorias_financeiras(id),
  valor_previsto  NUMERIC(15,2) NOT NULL CHECK (valor_previsto >= 0),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ano, mes, igreja_id, categoria_id)
);

-- 1.16 EVENTOS
CREATE TABLE eventos (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome               TEXT NOT NULL,
  tipo               TEXT,
  descricao          TEXT,
  local              TEXT,
  data_inicio        DATE NOT NULL,
  data_fim           DATE,
  hora_inicio        TIME,
  hora_fim           TIME,
  responsavel_id     UUID REFERENCES membros(id) ON DELETE SET NULL,
  igreja_id          UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  valor_inscricao    NUMERIC(15,2) NOT NULL DEFAULT 0,
  capacidade         INT CHECK (capacidade > 0),
  inscricoes_abertas BOOLEAN NOT NULL DEFAULT TRUE,
  imagem_url         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.17 EVENTOS INSCRIÇÕES
CREATE TABLE eventos_inscricoes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id       UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  membro_id       UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  data_inscricao  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pago            BOOLEAN NOT NULL DEFAULT FALSE,
  data_pagamento  TIMESTAMPTZ,
  valor_pago      NUMERIC(15,2),
  presente        BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (evento_id, membro_id)
);

-- 1.18 MENSAGENS
CREATE TABLE mensagens (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo                TEXT NOT NULL CHECK (tipo IN ('individual', 'grupo', 'massa')),
  destinatarios       JSONB, -- array de telefones ou IDs
  segmentacao         JSONB, -- {igreja_id, ministerio_id, cargo, status...}
  assunto             TEXT,
  mensagem            TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'rascunho'
                      CHECK (status IN ('rascunho', 'enviando', 'enviado', 'falhou')),
  total_destinatarios INT,
  total_enviados      INT NOT NULL DEFAULT 0,
  total_falhas        INT NOT NULL DEFAULT 0,
  data_envio          TIMESTAMPTZ,
  enviado_por         UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.19 PEDIDOS DE ORAÇÃO
CREATE TABLE pedidos_oracao (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membro_id    UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  descricao    TEXT NOT NULL,
  categoria    TEXT CHECK (categoria IN ('saude', 'familia', 'financeiro', 'trabalho', 'espiritual', 'outro')),
  status       TEXT NOT NULL DEFAULT 'ativo'
               CHECK (status IN ('ativo', 'respondido', 'cancelado')),
  privacidade  TEXT NOT NULL DEFAULT 'publico'
               CHECK (privacidade IN ('publico', 'lideranca')),
  data_pedido  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_resposta DATE,
  testemunho   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.20 AUDIT LOGS
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tabela        TEXT NOT NULL,
  registro_id   UUID,
  acao          TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_antigos JSONB,
  dados_novos   JSONB,
  usuario_id    UUID, -- sem FK para não bloquear deletes de usuários
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEÇÃO 2: ÍNDICES DE PERFORMANCE
-- ============================================================

-- Profiles
CREATE INDEX idx_profiles_igreja  ON profiles(igreja_id);
CREATE INDEX idx_profiles_role    ON profiles(role);

-- Membros
CREATE INDEX idx_membros_igreja   ON membros(igreja_id);
CREATE INDEX idx_membros_status   ON membros(status);
CREATE INDEX idx_membros_nome_fts ON membros USING gin(to_tsvector('portuguese', nome));
CREATE INDEX idx_membros_cpf      ON membros(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_membros_telefone ON membros(telefone) WHERE telefone IS NOT NULL;

-- Escalas
CREATE INDEX idx_escalas_igreja        ON escalas(igreja_id);
CREATE INDEX idx_escalas_mes_ano       ON escalas(mes, ano);
CREATE INDEX idx_escalas_status        ON escalas(status);
CREATE INDEX idx_escalas_det_escala    ON escalas_detalhes(escala_id);
CREATE INDEX idx_escalas_det_data      ON escalas_detalhes(data_culto);

-- Frequência
CREATE INDEX idx_frequencias_membro    ON frequencias(membro_id);
CREATE INDEX idx_frequencias_igreja    ON frequencias(igreja_id);
CREATE INDEX idx_frequencias_data      ON frequencias(data);

-- Financeiro
CREATE INDEX idx_lanc_igreja           ON lancamentos_financeiros(igreja_id);
CREATE INDEX idx_lanc_data             ON lancamentos_financeiros(data);
CREATE INDEX idx_lanc_tipo             ON lancamentos_financeiros(tipo);
CREATE INDEX idx_lanc_categoria        ON lancamentos_financeiros(categoria_id);
CREATE INDEX idx_lanc_conta            ON lancamentos_financeiros(conta_bancaria_id);
CREATE INDEX idx_lanc_status           ON lancamentos_financeiros(status);
CREATE INDEX idx_lanc_membro           ON lancamentos_financeiros(membro_id) WHERE membro_id IS NOT NULL;
CREATE INDEX idx_lanc_vencimento       ON lancamentos_financeiros(data_vencimento) WHERE data_vencimento IS NOT NULL;

-- Eventos
CREATE INDEX idx_eventos_igreja        ON eventos(igreja_id);
CREATE INDEX idx_eventos_data_inicio   ON eventos(data_inicio);
CREATE INDEX idx_eventos_ins_evento    ON eventos_inscricoes(evento_id);
CREATE INDEX idx_eventos_ins_membro    ON eventos_inscricoes(membro_id);

-- Mensagens
CREATE INDEX idx_mensagens_enviado_por ON mensagens(enviado_por);
CREATE INDEX idx_mensagens_status      ON mensagens(status);

-- Auditoria
CREATE INDEX idx_audit_tabela          ON audit_logs(tabela);
CREATE INDEX idx_audit_registro        ON audit_logs(registro_id);
CREATE INDEX idx_audit_usuario         ON audit_logs(usuario_id);
CREATE INDEX idx_audit_created_at      ON audit_logs(created_at DESC);

-- ============================================================
-- SEÇÃO 3: FUNÇÕES E TRIGGERS
-- ============================================================

-- 3.1 updated_at automático
CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at              BEFORE UPDATE ON profiles              FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_igrejas_updated_at               BEFORE UPDATE ON igrejas               FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_cultos_regulares_updated_at      BEFORE UPDATE ON cultos_regulares      FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_membros_updated_at               BEFORE UPDATE ON membros               FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_ministerios_updated_at           BEFORE UPDATE ON ministerios           FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_escalas_updated_at               BEFORE UPDATE ON escalas               FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_escalas_detalhes_updated_at      BEFORE UPDATE ON escalas_detalhes      FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_categorias_fin_updated_at        BEFORE UPDATE ON categorias_financeiras FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_contas_bancarias_updated_at      BEFORE UPDATE ON contas_bancarias      FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_lancamentos_updated_at           BEFORE UPDATE ON lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_despesas_recorrentes_updated_at  BEFORE UPDATE ON despesas_recorrentes  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_orcamento_updated_at             BEFORE UPDATE ON orcamento             FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_eventos_updated_at               BEFORE UPDATE ON eventos               FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_mensagens_updated_at             BEFORE UPDATE ON mensagens             FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
CREATE TRIGGER trg_pedidos_oracao_updated_at        BEFORE UPDATE ON pedidos_oracao        FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- 3.2 Atualização automática de saldo de conta bancária
CREATE OR REPLACE FUNCTION fn_atualizar_saldo_conta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- INSERT efetivado: creditou ou debitou
  IF TG_OP = 'INSERT' AND NEW.status = 'efetivado' AND NEW.conta_bancaria_id IS NOT NULL THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE contas_bancarias SET saldo_atual = saldo_atual + NEW.valor WHERE id = NEW.conta_bancaria_id;
    ELSE
      UPDATE contas_bancarias SET saldo_atual = saldo_atual - NEW.valor WHERE id = NEW.conta_bancaria_id;
    END IF;

  -- UPDATE: trata mudança de status e mudança de conta
  ELSIF TG_OP = 'UPDATE' THEN
    -- Reverter saldo antigo se estava efetivado
    IF OLD.status = 'efetivado' AND OLD.conta_bancaria_id IS NOT NULL THEN
      IF OLD.tipo = 'entrada' THEN
        UPDATE contas_bancarias SET saldo_atual = saldo_atual - OLD.valor WHERE id = OLD.conta_bancaria_id;
      ELSE
        UPDATE contas_bancarias SET saldo_atual = saldo_atual + OLD.valor WHERE id = OLD.conta_bancaria_id;
      END IF;
    END IF;
    -- Aplicar novo saldo se está efetivado
    IF NEW.status = 'efetivado' AND NEW.conta_bancaria_id IS NOT NULL THEN
      IF NEW.tipo = 'entrada' THEN
        UPDATE contas_bancarias SET saldo_atual = saldo_atual + NEW.valor WHERE id = NEW.conta_bancaria_id;
      ELSE
        UPDATE contas_bancarias SET saldo_atual = saldo_atual - NEW.valor WHERE id = NEW.conta_bancaria_id;
      END IF;
    END IF;

  -- DELETE: reverter se estava efetivado
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'efetivado' AND OLD.conta_bancaria_id IS NOT NULL THEN
    IF OLD.tipo = 'entrada' THEN
      UPDATE contas_bancarias SET saldo_atual = saldo_atual - OLD.valor WHERE id = OLD.conta_bancaria_id;
    ELSE
      UPDATE contas_bancarias SET saldo_atual = saldo_atual + OLD.valor WHERE id = OLD.conta_bancaria_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saldo_conta
AFTER INSERT OR UPDATE OR DELETE ON lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION fn_atualizar_saldo_conta();

-- 3.3 Trigger de auditoria (SECURITY DEFINER para contornar RLS em audit_logs)
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Tenta recuperar o usuário atual sem causar erro se não definido
  BEGIN
    v_user_id := current_setting('app.current_user_id', TRUE)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := auth.uid();
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), v_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (tabela, registro_id, acao, dados_antigos, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_user_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (tabela, registro_id, acao, dados_antigos, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), v_user_id);
    RETURN OLD;
  END IF;
END;
$$;

-- Auditoria em tabelas críticas
CREATE TRIGGER trg_audit_membros
  AFTER INSERT OR UPDATE OR DELETE ON membros
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_lancamentos
  AFTER INSERT OR UPDATE OR DELETE ON lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

CREATE TRIGGER trg_audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- 3.4 Criar profile automaticamente ao cadastrar usuário no Auth
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, nome, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'secretaria')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

-- ============================================================
-- SEÇÃO 4: VIEWS
-- ============================================================

-- Membros com funções agrupadas
CREATE OR REPLACE VIEW vw_membros_completo AS
SELECT
  m.*,
  i.nome AS igreja_nome,
  i.tipo AS igreja_tipo,
  COALESCE(
    json_agg(
      json_build_object('funcao', mf.funcao, 'nivel', mf.nivel)
    ) FILTER (WHERE mf.funcao IS NOT NULL),
    '[]'
  ) AS funcoes
FROM membros m
LEFT JOIN igrejas i ON i.id = m.igreja_id
LEFT JOIN membros_funcoes mf ON mf.membro_id = m.id AND mf.ativo = TRUE
GROUP BY m.id, i.nome, i.tipo;

-- Resumo financeiro mensal por igreja
CREATE OR REPLACE VIEW vw_financeiro_mensal AS
SELECT
  igreja_id,
  EXTRACT(YEAR  FROM data)::INT AS ano,
  EXTRACT(MONTH FROM data)::INT AS mes,
  tipo,
  SUM(valor)   AS total,
  COUNT(*)     AS quantidade
FROM lancamentos_financeiros
WHERE status = 'efetivado'
GROUP BY igreja_id, ano, mes, tipo;

-- Frequência por membro
CREATE OR REPLACE VIEW vw_frequencia_membros AS
SELECT
  m.id AS membro_id,
  m.nome,
  m.igreja_id,
  COUNT(f.id)                                          AS total_registros,
  COUNT(f.id) FILTER (WHERE f.presente = TRUE)         AS presencas,
  COUNT(f.id) FILTER (WHERE f.presente = FALSE)        AS faltas,
  ROUND(
    COUNT(f.id) FILTER (WHERE f.presente = TRUE)::NUMERIC
    / NULLIF(COUNT(f.id), 0) * 100,
  2) AS percentual_presenca
FROM membros m
LEFT JOIN frequencias f ON f.membro_id = m.id
WHERE m.status = 'ativo'
GROUP BY m.id, m.nome, m.igreja_id;

-- ============================================================
-- SEÇÃO 5: FUNÇÕES DE NEGÓCIO
-- ============================================================

-- 5.1 Buscar membros disponíveis para uma função na escala
CREATE OR REPLACE FUNCTION buscar_membros_disponiveis(
  p_funcao      TEXT,
  p_data_culto  DATE,
  p_igreja_id   UUID,
  p_excluir_ids UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  membro_id            UUID,
  nome                 TEXT,
  nivel                TEXT,
  ultima_escalacao     DATE,
  total_escalacoes_mes INT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH escalacoes AS (
    SELECT
      CASE p_funcao
        WHEN 'oracao'    THEN ed.membro_oracao_id
        WHEN 'louvor'    THEN ed.membro_louvor_id
        WHEN 'pregacao'  THEN ed.membro_pregacao_id
        WHEN 'som'       THEN ed.membro_som_id
        WHEN 'recepcao'  THEN ed.membro_recepcao_id
        WHEN 'midia'     THEN ed.membro_midia_id
        WHEN 'infantil'  THEN ed.membro_infantil_id
      END AS membro_id_esc,
      ed.data_culto
    FROM escalas_detalhes ed
    JOIN escalas e ON e.id = ed.escala_id
    WHERE e.igreja_id = p_igreja_id
      AND ed.data_culto <= p_data_culto
      AND e.status IN ('finalizada', 'enviada')
  )
  SELECT
    m.id,
    m.nome,
    mf.nivel,
    MAX(esc.data_culto)::DATE AS ultima_escalacao,
    COUNT(esc.membro_id_esc) FILTER (
      WHERE esc.data_culto >= date_trunc('month', p_data_culto)
        AND esc.data_culto <  date_trunc('month', p_data_culto) + INTERVAL '1 month'
    )::INT AS total_escalacoes_mes
  FROM membros m
  JOIN membros_funcoes mf ON mf.membro_id = m.id AND mf.ativo = TRUE AND mf.funcao = p_funcao
  LEFT JOIN escalacoes esc ON esc.membro_id_esc = m.id
  WHERE m.igreja_id = p_igreja_id
    AND m.status = 'ativo'
    AND NOT (m.id = ANY(p_excluir_ids))
    AND (
      m.disponibilidade IS NULL OR
      m.disponibilidade->'dias' @> to_jsonb(EXTRACT(DOW FROM p_data_culto)::INT)
    )
  GROUP BY m.id, m.nome, mf.nivel
  ORDER BY
    total_escalacoes_mes ASC,
    ultima_escalacao ASC NULLS FIRST,
    CASE mf.nivel WHEN 'avancado' THEN 1 WHEN 'intermediario' THEN 2 ELSE 3 END;
END;
$$;

-- 5.2 Gerar escala automaticamente
CREATE OR REPLACE FUNCTION gerar_escala_automatica(
  p_mes        INT,
  p_ano        INT,
  p_igreja_id  UUID,
  p_created_by UUID
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_escala_id         UUID;
  v_culto             RECORD;
  v_data_culto        DATE;
  v_data_inicio       DATE;
  v_data_fim          DATE;
  v_membro_oracao     UUID;
  v_membro_louvor     UUID;
  v_membro_pregacao   UUID;
  v_membro_som        UUID;
  v_membro_recepcao   UUID;
  v_membro_midia      UUID;
  v_membro_infantil   UUID;
BEGIN
  INSERT INTO escalas (mes, ano, igreja_id, status, created_by)
  VALUES (p_mes, p_ano, p_igreja_id, 'rascunho', p_created_by)
  RETURNING id INTO v_escala_id;

  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim    := (v_data_inicio + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  FOR v_culto IN
    SELECT * FROM cultos_regulares WHERE igreja_id = p_igreja_id AND ativo = TRUE
  LOOP
    v_data_culto := v_data_inicio;
    WHILE v_data_culto <= v_data_fim LOOP
      IF EXTRACT(DOW FROM v_data_culto) = v_culto.dia_semana THEN

        SELECT membro_id INTO v_membro_oracao   FROM buscar_membros_disponiveis('oracao',   v_data_culto, p_igreja_id) LIMIT 1;
        SELECT membro_id INTO v_membro_louvor   FROM buscar_membros_disponiveis('louvor',   v_data_culto, p_igreja_id) LIMIT 1;
        SELECT membro_id INTO v_membro_pregacao FROM buscar_membros_disponiveis('pregacao', v_data_culto, p_igreja_id) LIMIT 1;
        SELECT membro_id INTO v_membro_som      FROM buscar_membros_disponiveis('som',      v_data_culto, p_igreja_id) LIMIT 1;
        SELECT membro_id INTO v_membro_recepcao FROM buscar_membros_disponiveis('recepcao', v_data_culto, p_igreja_id) LIMIT 1;
        SELECT membro_id INTO v_membro_midia    FROM buscar_membros_disponiveis('midia',    v_data_culto, p_igreja_id) LIMIT 1;
        SELECT membro_id INTO v_membro_infantil FROM buscar_membros_disponiveis('infantil', v_data_culto, p_igreja_id) LIMIT 1;

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
      v_data_culto := v_data_culto + INTERVAL '1 day';
    END LOOP;
  END LOOP;

  RETURN v_escala_id;
END;
$$;

-- 5.3 Reescalar membro em posição específica
CREATE OR REPLACE FUNCTION reescalar_membro(
  p_detalhe_escala_id  UUID,
  p_funcao             TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_detalhe         RECORD;
  v_novo_membro_id  UUID;
  v_excluir         UUID[];
BEGIN
  SELECT * INTO v_detalhe FROM escalas_detalhes WHERE id = p_detalhe_escala_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Detalhe de escala não encontrado: %', p_detalhe_escala_id;
  END IF;

  v_excluir := ARRAY_REMOVE(ARRAY[
    v_detalhe.membro_oracao_id, v_detalhe.membro_louvor_id,
    v_detalhe.membro_pregacao_id, v_detalhe.membro_som_id,
    v_detalhe.membro_recepcao_id, v_detalhe.membro_midia_id,
    v_detalhe.membro_infantil_id
  ], NULL);

  SELECT membro_id INTO v_novo_membro_id
  FROM buscar_membros_disponiveis(
    p_funcao, v_detalhe.data_culto,
    (SELECT igreja_id FROM escalas WHERE id = v_detalhe.escala_id),
    v_excluir
  )
  LIMIT 1;

  IF v_novo_membro_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum membro disponível para a função: %', p_funcao;
  END IF;

  CASE p_funcao
    WHEN 'oracao'   THEN UPDATE escalas_detalhes SET membro_oracao_id   = v_novo_membro_id, status_confirmacao_oracao   = 'pendente' WHERE id = p_detalhe_escala_id;
    WHEN 'louvor'   THEN UPDATE escalas_detalhes SET membro_louvor_id   = v_novo_membro_id, status_confirmacao_louvor   = 'pendente' WHERE id = p_detalhe_escala_id;
    WHEN 'pregacao' THEN UPDATE escalas_detalhes SET membro_pregacao_id = v_novo_membro_id, status_confirmacao_pregacao = 'pendente' WHERE id = p_detalhe_escala_id;
    WHEN 'som'      THEN UPDATE escalas_detalhes SET membro_som_id      = v_novo_membro_id, status_confirmacao_som      = 'pendente' WHERE id = p_detalhe_escala_id;
    WHEN 'recepcao' THEN UPDATE escalas_detalhes SET membro_recepcao_id = v_novo_membro_id, status_confirmacao_recepcao = 'pendente' WHERE id = p_detalhe_escala_id;
    WHEN 'midia'    THEN UPDATE escalas_detalhes SET membro_midia_id    = v_novo_membro_id, status_confirmacao_midia    = 'pendente' WHERE id = p_detalhe_escala_id;
    WHEN 'infantil' THEN UPDATE escalas_detalhes SET membro_infantil_id = v_novo_membro_id, status_confirmacao_infantil = 'pendente' WHERE id = p_detalhe_escala_id;
  END CASE;

  RETURN v_novo_membro_id;
END;
$$;

-- 5.4 Estatísticas financeiras por período
CREATE OR REPLACE FUNCTION estatisticas_financeiras(
  p_igreja_id   UUID,
  p_data_inicio DATE,
  p_data_fim    DATE
)
RETURNS TABLE (
  total_entradas       NUMERIC,
  total_saidas         NUMERIC,
  saldo                NUMERIC,
  total_dizimos        NUMERIC,
  total_ofertas        NUMERIC,
  categoria_maior_gasto TEXT,
  valor_maior_gasto    NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT l.tipo, l.valor, l.status, c.nome AS cat_nome
    FROM lancamentos_financeiros l
    JOIN categorias_financeiras c ON c.id = l.categoria_id
    WHERE l.igreja_id = p_igreja_id
      AND l.data BETWEEN p_data_inicio AND p_data_fim
      AND l.status = 'efetivado'
  ),
  stats AS (
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0)                                         AS entradas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'),   0)                                         AS saidas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND cat_nome = 'Dízimos'), 0)                AS dizimos,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND cat_nome = 'Ofertas'), 0)                AS ofertas
    FROM base
  ),
  maior_gasto AS (
    SELECT cat_nome, SUM(valor) AS total
    FROM base WHERE tipo = 'saida'
    GROUP BY cat_nome ORDER BY total DESC LIMIT 1
  )
  SELECT
    s.entradas, s.saidas, s.entradas - s.saidas,
    s.dizimos, s.ofertas,
    mg.cat_nome, mg.total
  FROM stats s LEFT JOIN maior_gasto mg ON TRUE;
END;
$$;

-- 5.5 Gerar lançamentos de despesas recorrentes
CREATE OR REPLACE FUNCTION gerar_lancamentos_recorrentes(
  p_mes INT,
  p_ano INT
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_despesa         RECORD;
  v_data_vencimento DATE;
  v_admin_id        UUID;
  v_count           INT := 0;
BEGIN
  SELECT id INTO v_admin_id FROM profiles WHERE role = 'admin' AND ativo = TRUE LIMIT 1;

  FOR v_despesa IN
    SELECT * FROM despesas_recorrentes
    WHERE ativo = TRUE
      AND make_date(p_ano, p_mes, 1) >= data_inicio
      AND (data_fim IS NULL OR make_date(p_ano, p_mes, 1) <= data_fim)
  LOOP
    v_data_vencimento := make_date(
      p_ano, p_mes,
      LEAST(v_despesa.dia_vencimento,
        EXTRACT(DAY FROM (make_date(p_ano, p_mes, 1) + INTERVAL '1 month' - INTERVAL '1 day'))::INT
      )
    );

    IF NOT EXISTS (
      SELECT 1 FROM lancamentos_financeiros
      WHERE igreja_id     = v_despesa.igreja_id
        AND categoria_id  = v_despesa.categoria_id
        AND recorrente    = TRUE
        AND EXTRACT(YEAR  FROM data_vencimento) = p_ano
        AND EXTRACT(MONTH FROM data_vencimento) = p_mes
        AND (fornecedor = v_despesa.fornecedor OR (fornecedor IS NULL AND v_despesa.fornecedor IS NULL))
    ) THEN
      INSERT INTO lancamentos_financeiros (
        data, tipo, categoria_id, valor, forma_pagamento,
        conta_bancaria_id, igreja_id, fornecedor, descricao,
        status, data_vencimento, recorrente, created_by
      ) VALUES (
        v_data_vencimento, 'saida', v_despesa.categoria_id, v_despesa.valor, 'boleto',
        v_despesa.conta_bancaria_id, v_despesa.igreja_id, v_despesa.fornecedor,
        v_despesa.nome || ' — ' || to_char(v_data_vencimento, 'MM/YYYY'),
        'agendado', v_data_vencimento, TRUE, v_admin_id
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5.6 Calcular frequência de um membro
CREATE OR REPLACE FUNCTION calcular_frequencia_membro(
  p_membro_id   UUID,
  p_data_inicio DATE,
  p_data_fim    DATE
)
RETURNS TABLE (
  total_cultos INT,
  presencas    INT,
  faltas       INT,
  percentual   NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE presente = TRUE)::INT,
    COUNT(*) FILTER (WHERE presente = FALSE)::INT,
    ROUND(
      COUNT(*) FILTER (WHERE presente = TRUE)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    2)
  FROM frequencias
  WHERE membro_id = p_membro_id
    AND data BETWEEN p_data_inicio AND p_data_fim;
END;
$$;

-- ============================================================
-- SEÇÃO 6: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE igrejas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultos_regulares      ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros               ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_funcoes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministerios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministerios_membros   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_detalhes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequencias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_recorrentes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_inscricoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_oracao        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNÇÕES AUXILIARES RLS (SECURITY DEFINER = sem recursão)
-- ============================================================

CREATE OR REPLACE FUNCTION rls_is_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND ativo = TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION rls_get_igreja_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT igreja_id FROM profiles WHERE id = auth.uid() AND ativo = TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION rls_tem_permissao_financeira()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'pastor', 'tesoureiro') AND ativo = TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION rls_tem_permissao_escrita()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'pastor', 'secretaria') AND ativo = TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION rls_pertence_igreja(p_igreja_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (rls_get_igreja_id() = p_igreja_id) OR rls_is_admin();
END;
$$;

-- ============================================================
-- POLICIES — PROFILES
-- ============================================================

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_same_church"
  ON profiles FOR SELECT
  USING (rls_get_igreja_id() = igreja_id AND rls_get_igreja_id() IS NOT NULL);

CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT USING (rls_is_admin());

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE USING (rls_is_admin());

CREATE POLICY "profiles_insert_system"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- POLICIES — IGREJAS
-- ============================================================

CREATE POLICY "igrejas_select_authenticated"
  ON igrejas FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "igrejas_manage_admin"
  ON igrejas FOR ALL USING (rls_is_admin());

-- ============================================================
-- POLICIES — CULTOS REGULARES
-- ============================================================

CREATE POLICY "cultos_select_same_church"
  ON cultos_regulares FOR SELECT USING (rls_pertence_igreja(igreja_id));

CREATE POLICY "cultos_manage_pastor"
  ON cultos_regulares FOR ALL
  USING (
    rls_pertence_igreja(igreja_id) AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','pastor') AND ativo = TRUE)
  );

-- ============================================================
-- POLICIES — MEMBROS
-- ============================================================

CREATE POLICY "membros_select_same_church"
  ON membros FOR SELECT USING (rls_pertence_igreja(igreja_id));

CREATE POLICY "membros_insert_staff"
  ON membros FOR INSERT
  WITH CHECK (rls_tem_permissao_escrita() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "membros_update_staff"
  ON membros FOR UPDATE
  USING (rls_tem_permissao_escrita() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "membros_delete_admin"
  ON membros FOR DELETE USING (rls_is_admin());

-- ============================================================
-- POLICIES — MEMBROS FUNÇÕES
-- ============================================================

CREATE POLICY "membros_funcoes_select"
  ON membros_funcoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM membros m
      WHERE m.id = membros_funcoes.membro_id AND rls_pertence_igreja(m.igreja_id)
    )
  );

CREATE POLICY "membros_funcoes_manage_staff"
  ON membros_funcoes FOR ALL USING (rls_tem_permissao_escrita());

-- ============================================================
-- POLICIES — MINISTÉRIOS
-- ============================================================

CREATE POLICY "ministerios_select_same_church"
  ON ministerios FOR SELECT USING (rls_pertence_igreja(igreja_id));

CREATE POLICY "ministerios_manage_staff"
  ON ministerios FOR ALL
  USING (rls_tem_permissao_escrita() AND rls_pertence_igreja(igreja_id));

-- ============================================================
-- POLICIES — MINISTÉRIOS MEMBROS
-- ============================================================

CREATE POLICY "ministerios_membros_select"
  ON ministerios_membros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ministerios mi
      WHERE mi.id = ministerios_membros.ministerio_id AND rls_pertence_igreja(mi.igreja_id)
    )
  );

CREATE POLICY "ministerios_membros_manage_staff"
  ON ministerios_membros FOR ALL USING (rls_tem_permissao_escrita());

-- ============================================================
-- POLICIES — ESCALAS
-- ============================================================

CREATE POLICY "escalas_select_same_church"
  ON escalas FOR SELECT USING (rls_pertence_igreja(igreja_id));

CREATE POLICY "escalas_manage_staff"
  ON escalas FOR ALL
  USING (rls_tem_permissao_escrita() AND rls_pertence_igreja(igreja_id));

-- ============================================================
-- POLICIES — ESCALAS DETALHES
-- ============================================================

CREATE POLICY "escalas_det_select"
  ON escalas_detalhes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM escalas e
      WHERE e.id = escalas_detalhes.escala_id AND rls_pertence_igreja(e.igreja_id)
    )
  );

CREATE POLICY "escalas_det_manage_staff"
  ON escalas_detalhes FOR ALL USING (rls_tem_permissao_escrita());

-- ============================================================
-- POLICIES — FREQUÊNCIAS
-- ============================================================

CREATE POLICY "frequencias_select_same_church"
  ON frequencias FOR SELECT USING (rls_pertence_igreja(igreja_id));

CREATE POLICY "frequencias_manage_staff"
  ON frequencias FOR ALL
  USING (rls_tem_permissao_escrita() AND rls_pertence_igreja(igreja_id));

-- ============================================================
-- POLICIES — CATEGORIAS FINANCEIRAS
-- ============================================================

CREATE POLICY "categorias_select_authenticated"
  ON categorias_financeiras FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "categorias_manage_admin"
  ON categorias_financeiras FOR ALL USING (rls_is_admin());

-- ============================================================
-- POLICIES — CONTAS BANCÁRIAS
-- ============================================================

CREATE POLICY "contas_select_financeiro"
  ON contas_bancarias FOR SELECT
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "contas_manage_financeiro"
  ON contas_bancarias FOR ALL
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

-- ============================================================
-- POLICIES — LANÇAMENTOS FINANCEIROS
-- ============================================================

CREATE POLICY "lancamentos_select_financeiro"
  ON lancamentos_financeiros FOR SELECT
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "lancamentos_insert_financeiro"
  ON lancamentos_financeiros FOR INSERT
  WITH CHECK (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "lancamentos_update_financeiro"
  ON lancamentos_financeiros FOR UPDATE
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "lancamentos_delete_admin"
  ON lancamentos_financeiros FOR DELETE USING (rls_is_admin());

-- ============================================================
-- POLICIES — DESPESAS RECORRENTES
-- ============================================================

CREATE POLICY "despesas_rec_select"
  ON despesas_recorrentes FOR SELECT
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "despesas_rec_manage"
  ON despesas_recorrentes FOR ALL
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

-- ============================================================
-- POLICIES — ORÇAMENTO
-- ============================================================

CREATE POLICY "orcamento_select"
  ON orcamento FOR SELECT
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

CREATE POLICY "orcamento_manage"
  ON orcamento FOR ALL
  USING (rls_tem_permissao_financeira() AND rls_pertence_igreja(igreja_id));

-- ============================================================
-- POLICIES — EVENTOS
-- ============================================================

CREATE POLICY "eventos_select_same_church"
  ON eventos FOR SELECT USING (rls_pertence_igreja(igreja_id));

CREATE POLICY "eventos_manage_staff"
  ON eventos FOR ALL
  USING (rls_tem_permissao_escrita() AND rls_pertence_igreja(igreja_id));

-- ============================================================
-- POLICIES — EVENTOS INSCRIÇÕES
-- ============================================================

CREATE POLICY "eventos_ins_select"
  ON eventos_inscricoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eventos e
      WHERE e.id = eventos_inscricoes.evento_id AND rls_pertence_igreja(e.igreja_id)
    )
  );

CREATE POLICY "eventos_ins_manage_staff"
  ON eventos_inscricoes FOR ALL USING (rls_tem_permissao_escrita());

-- ============================================================
-- POLICIES — MENSAGENS
-- ============================================================

CREATE POLICY "mensagens_select"
  ON mensagens FOR SELECT
  USING (auth.uid() = enviado_por OR rls_is_admin());

CREATE POLICY "mensagens_insert_staff"
  ON mensagens FOR INSERT
  WITH CHECK (rls_tem_permissao_escrita() AND auth.uid() = enviado_por);

CREATE POLICY "mensagens_update"
  ON mensagens FOR UPDATE
  USING (auth.uid() = enviado_por OR rls_is_admin());

-- ============================================================
-- POLICIES — PEDIDOS DE ORAÇÃO
-- ============================================================

CREATE POLICY "pedidos_select_publico"
  ON pedidos_oracao FOR SELECT
  USING (
    privacidade = 'publico' AND
    EXISTS (
      SELECT 1 FROM membros m
      WHERE m.id = pedidos_oracao.membro_id AND rls_pertence_igreja(m.igreja_id)
    )
  );

CREATE POLICY "pedidos_select_lideranca"
  ON pedidos_oracao FOR SELECT
  USING (
    privacidade = 'lideranca' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'pastor') AND ativo = TRUE
    )
  );

CREATE POLICY "pedidos_insert_authenticated"
  ON pedidos_oracao FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "pedidos_update_lideranca"
  ON pedidos_oracao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'pastor') AND ativo = TRUE
    )
  );

-- ============================================================
-- POLICIES — AUDIT LOGS
-- ============================================================

-- Somente admin pode ler
CREATE POLICY "audit_select_admin"
  ON audit_logs FOR SELECT USING (rls_is_admin());

-- Inserção apenas pelo trigger SECURITY DEFINER (service role bypassa RLS por padrão)
-- Nenhuma policy de INSERT: o trigger usa SECURITY DEFINER como owner

-- ============================================================
-- SEÇÃO 7: DADOS INICIAIS
-- ============================================================

INSERT INTO categorias_financeiras (nome, tipo, cor, icone) VALUES
  ('Dízimos',             'entrada', '#22c55e', 'coins'),
  ('Ofertas',             'entrada', '#3b82f6', 'heart'),
  ('Doações',             'entrada', '#8b5cf6', 'gift'),
  ('Eventos',             'entrada', '#f59e0b', 'calendar'),
  ('Aluguel',             'saida',   '#ef4444', 'home'),
  ('Água',                'saida',   '#06b6d4', 'droplets'),
  ('Luz',                 'saida',   '#eab308', 'zap'),
  ('Internet',            'saida',   '#6366f1', 'wifi'),
  ('Material de Limpeza', 'saida',   '#84cc16', 'spray-can'),
  ('Material de Escritório','saida', '#a855f7', 'file-text'),
  ('Manutenção',          'saida',   '#f97316', 'wrench'),
  ('Salários',            'saida',   '#14b8a6', 'users'),
  ('Combustível',         'saida',   '#ec4899', 'fuel'),
  ('Missões',             'saida',   '#0ea5e9', 'send');

-- ============================================================
-- SEÇÃO 8: PRIMEIRO ADMIN
-- ============================================================
-- INSTRUÇÕES:
-- 1. Crie o usuário no Supabase Auth Dashboard (Authentication > Users > Add user)
--    com o e-mail e senha desejados
-- 2. Copie o UUID gerado
-- 3. Execute o UPDATE abaixo substituindo os valores:
--
-- UPDATE profiles
-- SET
--   role      = 'admin',
--   nome      = 'Nome do Administrador',
--   igreja_id = (SELECT id FROM igrejas WHERE nome = 'Igreja Pentecostal Vale da Bênção')
-- WHERE email = 'admin@ipvb.com.br';
--
-- 4. Se quiser criar a igreja antes:
--
-- INSERT INTO igrejas (nome, tipo, email)
-- VALUES ('Igreja Pentecostal Vale da Bênção', 'sede', 'contato@ipvb.com.br');

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
