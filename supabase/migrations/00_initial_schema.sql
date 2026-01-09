-- =============================================
-- Sistema de Gestão para Igrejas - Schema Inicial
-- =============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- 1. PROFILES & AUTH
-- =============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pastor', 'tesoureiro', 'secretaria', 'lider_ministerio')),
  igreja_id UUID,
  telefone TEXT,
  foto_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. IGREJAS
-- =============================================

CREATE TABLE igrejas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('sede', 'congregacao')),
  endereco JSONB,
  responsavel_id UUID REFERENCES profiles(id),
  telefone TEXT,
  email TEXT,
  capacidade INT,
  logo_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar FK após tabela profiles existir
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_igreja
  FOREIGN KEY (igreja_id) REFERENCES igrejas(id) ON DELETE SET NULL;

CREATE TABLE cultos_regulares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo, 6=sábado
  horario TIME NOT NULL,
  tipo TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. MEMBROS
-- =============================================

CREATE TABLE membros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE,
  email TEXT,
  telefone TEXT,
  data_nascimento DATE,
  sexo TEXT CHECK (sexo IN ('M', 'F')),
  endereco JSONB,
  estado_civil TEXT CHECK (estado_civil IN ('solteiro', 'casado', 'viuvo', 'divorciado')),
  foto_url TEXT,
  cargo TEXT,
  dizimista BOOLEAN DEFAULT FALSE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE RESTRICT,
  data_batismo DATE,
  data_entrada DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('ativo', 'inativo', 'visitante')) DEFAULT 'ativo',
  disponibilidade JSONB, -- {dias: [0,1,3,5], horarios: ["manha", "tarde", "noite"]}
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE membros_funcoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membro_id UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  funcao TEXT NOT NULL CHECK (funcao IN ('oracao', 'louvor', 'pregacao', 'som', 'recepcao', 'midia', 'infantil')),
  nivel TEXT CHECK (nivel IN ('iniciante', 'intermediario', 'avancado')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(membro_id, funcao)
);

-- =============================================
-- 4. MINISTÉRIOS
-- =============================================

CREATE TABLE ministerios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  lider_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  cor TEXT DEFAULT '#085832',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ministerios_membros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ministerio_id UUID NOT NULL REFERENCES ministerios(id) ON DELETE CASCADE,
  membro_id UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  funcao TEXT,
  data_entrada DATE DEFAULT CURRENT_DATE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ministerio_id, membro_id)
);

-- =============================================
-- 5. ESCALAS
-- =============================================

CREATE TABLE escalas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INT NOT NULL,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('rascunho', 'confirmando', 'finalizada', 'enviada')) DEFAULT 'rascunho',
  pdf_url TEXT,
  data_geracao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_finalizacao TIMESTAMP WITH TIME ZONE,
  data_envio TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mes, ano, igreja_id)
);

CREATE TABLE escalas_detalhes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escala_id UUID NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
  data_culto DATE NOT NULL,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario TIME NOT NULL,
  tipo_culto TEXT,

  -- Membros escalados por função
  membro_oracao_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_louvor_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_pregacao_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_som_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_recepcao_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_midia_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  membro_infantil_id UUID REFERENCES membros(id) ON DELETE SET NULL,

  -- Status de confirmação
  status_confirmacao_oracao TEXT CHECK (status_confirmacao_oracao IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',
  status_confirmacao_louvor TEXT CHECK (status_confirmacao_louvor IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',
  status_confirmacao_pregacao TEXT CHECK (status_confirmacao_pregacao IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',
  status_confirmacao_som TEXT CHECK (status_confirmacao_som IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',
  status_confirmacao_recepcao TEXT CHECK (status_confirmacao_recepcao IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',
  status_confirmacao_midia TEXT CHECK (status_confirmacao_midia IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',
  status_confirmacao_infantil TEXT CHECK (status_confirmacao_infantil IN ('pendente', 'confirmado', 'recusado')) DEFAULT 'pendente',

  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 6. FREQUÊNCIA
-- =============================================

CREATE TABLE frequencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membro_id UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo_culto TEXT,
  presente BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(membro_id, data, tipo_culto)
);

-- =============================================
-- 7. FINANCEIRO
-- =============================================

CREATE TABLE categorias_financeiras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  cor TEXT DEFAULT '#085832',
  icone TEXT,
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE contas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  banco TEXT,
  agencia TEXT,
  conta TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente', 'poupanca', 'caixa')),
  saldo_inicial NUMERIC(15,2) DEFAULT 0,
  saldo_atual NUMERIC(15,2) DEFAULT 0,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria_id UUID NOT NULL REFERENCES categorias_financeiras(id),
  valor NUMERIC(15,2) NOT NULL CHECK (valor > 0),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'pix', 'transferencia', 'debito', 'credito', 'boleto', 'cheque')),
  conta_bancaria_id UUID REFERENCES contas_bancarias(id),
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  membro_id UUID REFERENCES membros(id), -- se for dízimo/oferta de membro específico
  fornecedor TEXT,
  descricao TEXT NOT NULL,
  comprovante_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('efetivado', 'pendente', 'agendado', 'cancelado')) DEFAULT 'efetivado',
  data_vencimento DATE,
  data_pagamento DATE,

  -- Parcelamento
  parcelado BOOLEAN DEFAULT FALSE,
  numero_parcelas INT,
  parcela_atual INT,
  lancamento_pai_id UUID REFERENCES lancamentos_financeiros(id) ON DELETE CASCADE,

  -- Recorrência
  recorrente BOOLEAN DEFAULT FALSE,

  -- Conciliação
  conciliado BOOLEAN DEFAULT FALSE,
  data_conciliacao TIMESTAMP WITH TIME ZONE,

  observacoes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE despesas_recorrentes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  categoria_id UUID NOT NULL REFERENCES categorias_financeiras(id),
  valor NUMERIC(15,2) NOT NULL,
  dia_vencimento INT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  conta_bancaria_id UUID REFERENCES contas_bancarias(id),
  fornecedor TEXT,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT TRUE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orcamento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias_financeiras(id),
  valor_previsto NUMERIC(15,2) NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ano, mes, igreja_id, categoria_id)
);

-- =============================================
-- 8. EVENTOS
-- =============================================

CREATE TABLE eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo TEXT,
  descricao TEXT,
  local TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  hora_inicio TIME,
  hora_fim TIME,
  responsavel_id UUID REFERENCES membros(id) ON DELETE SET NULL,
  igreja_id UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  valor_inscricao NUMERIC(15,2) DEFAULT 0,
  capacidade INT,
  inscricoes_abertas BOOLEAN DEFAULT TRUE,
  imagem_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE eventos_inscricoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  membro_id UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  data_inscricao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  pago BOOLEAN DEFAULT FALSE,
  data_pagamento TIMESTAMP WITH TIME ZONE,
  valor_pago NUMERIC(15,2),
  presente BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(evento_id, membro_id)
);

-- =============================================
-- 9. COMUNICAÇÃO
-- =============================================

CREATE TABLE mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo TEXT NOT NULL CHECK (tipo IN ('individual', 'grupo', 'massa')),
  destinatarios JSONB, -- array de telefones ou IDs
  segmentacao JSONB, -- {igreja_id, ministerio_id, cargo, status, etc}
  assunto TEXT,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('rascunho', 'enviando', 'enviado', 'falhou')) DEFAULT 'rascunho',
  total_destinatarios INT,
  total_enviados INT DEFAULT 0,
  total_falhas INT DEFAULT 0,
  data_envio TIMESTAMP WITH TIME ZONE,
  enviado_por UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 10. PEDIDOS DE ORAÇÃO
-- =============================================

CREATE TABLE pedidos_oracao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membro_id UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('saude', 'familia', 'financeiro', 'trabalho', 'espiritual', 'outro')),
  status TEXT NOT NULL CHECK (status IN ('ativo', 'respondido', 'cancelado')) DEFAULT 'ativo',
  privacidade TEXT NOT NULL CHECK (privacidade IN ('publico', 'lideranca')) DEFAULT 'publico',
  data_pedido DATE DEFAULT CURRENT_DATE,
  data_resposta DATE,
  testemunho TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 11. AUDITORIA
-- =============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tabela TEXT NOT NULL,
  registro_id UUID,
  acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_antigos JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES profiles(id),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

-- Profiles
CREATE INDEX idx_profiles_igreja ON profiles(igreja_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Membros
CREATE INDEX idx_membros_igreja ON membros(igreja_id);
CREATE INDEX idx_membros_status ON membros(status);
CREATE INDEX idx_membros_nome ON membros USING gin(to_tsvector('portuguese', nome));
CREATE INDEX idx_membros_cpf ON membros(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX idx_membros_telefone ON membros(telefone) WHERE telefone IS NOT NULL;

-- Escalas
CREATE INDEX idx_escalas_igreja ON escalas(igreja_id);
CREATE INDEX idx_escalas_mes_ano ON escalas(mes, ano);
CREATE INDEX idx_escalas_status ON escalas(status);
CREATE INDEX idx_escalas_detalhes_escala ON escalas_detalhes(escala_id);
CREATE INDEX idx_escalas_detalhes_data ON escalas_detalhes(data_culto);

-- Frequência
CREATE INDEX idx_frequencias_membro ON frequencias(membro_id);
CREATE INDEX idx_frequencias_igreja ON frequencias(igreja_id);
CREATE INDEX idx_frequencias_data ON frequencias(data);

-- Financeiro
CREATE INDEX idx_lancamentos_igreja ON lancamentos_financeiros(igreja_id);
CREATE INDEX idx_lancamentos_data ON lancamentos_financeiros(data);
CREATE INDEX idx_lancamentos_tipo ON lancamentos_financeiros(tipo);
CREATE INDEX idx_lancamentos_categoria ON lancamentos_financeiros(categoria_id);
CREATE INDEX idx_lancamentos_conta ON lancamentos_financeiros(conta_bancaria_id);
CREATE INDEX idx_lancamentos_status ON lancamentos_financeiros(status);
CREATE INDEX idx_lancamentos_membro ON lancamentos_financeiros(membro_id) WHERE membro_id IS NOT NULL;

-- Eventos
CREATE INDEX idx_eventos_igreja ON eventos(igreja_id);
CREATE INDEX idx_eventos_data_inicio ON eventos(data_inicio);
CREATE INDEX idx_eventos_inscricoes_evento ON eventos_inscricoes(evento_id);
CREATE INDEX idx_eventos_inscricoes_membro ON eventos_inscricoes(membro_id);

-- Mensagens
CREATE INDEX idx_mensagens_enviado_por ON mensagens(enviado_por);
CREATE INDEX idx_mensagens_status ON mensagens(status);
CREATE INDEX idx_mensagens_data_envio ON mensagens(data_envio);

-- Auditoria
CREATE INDEX idx_audit_logs_tabela ON audit_logs(tabela);
CREATE INDEX idx_audit_logs_registro ON audit_logs(registro_id);
CREATE INDEX idx_audit_logs_usuario ON audit_logs(usuario_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- =============================================
-- FUNÇÕES E TRIGGERS
-- =============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_igrejas_updated_at BEFORE UPDATE ON igrejas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cultos_regulares_updated_at BEFORE UPDATE ON cultos_regulares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_membros_updated_at BEFORE UPDATE ON membros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ministerios_updated_at BEFORE UPDATE ON ministerios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_escalas_updated_at BEFORE UPDATE ON escalas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_escalas_detalhes_updated_at BEFORE UPDATE ON escalas_detalhes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_categorias_financeiras_updated_at BEFORE UPDATE ON categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_contas_bancarias_updated_at BEFORE UPDATE ON contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lancamentos_financeiros_updated_at BEFORE UPDATE ON lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_despesas_recorrentes_updated_at BEFORE UPDATE ON despesas_recorrentes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orcamento_updated_at BEFORE UPDATE ON orcamento
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_eventos_updated_at BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_mensagens_updated_at BEFORE UPDATE ON mensagens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_pedidos_oracao_updated_at BEFORE UPDATE ON pedidos_oracao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função para atualizar saldo de conta bancária
CREATE OR REPLACE FUNCTION atualizar_saldo_conta()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o lançamento foi efetivado
  IF NEW.status = 'efetivado' AND NEW.conta_bancaria_id IS NOT NULL THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual + NEW.valor
      WHERE id = NEW.conta_bancaria_id;
    ELSE
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual - NEW.valor
      WHERE id = NEW.conta_bancaria_id;
    END IF;
  END IF;

  -- Se o status mudou de efetivado para outro, reverter
  IF OLD.status = 'efetivado' AND NEW.status != 'efetivado' AND OLD.conta_bancaria_id IS NOT NULL THEN
    IF OLD.tipo = 'entrada' THEN
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual - OLD.valor
      WHERE id = OLD.conta_bancaria_id;
    ELSE
      UPDATE contas_bancarias
      SET saldo_atual = saldo_atual + OLD.valor
      WHERE id = OLD.conta_bancaria_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_saldo_conta
AFTER INSERT OR UPDATE ON lancamentos_financeiros
FOR EACH ROW EXECUTE FUNCTION atualizar_saldo_conta();

-- Função para auditoria automática
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (tabela, registro_id, acao, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), current_setting('app.current_user_id', TRUE)::UUID);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (tabela, registro_id, acao, dados_antigos, dados_novos, usuario_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), current_setting('app.current_user_id', TRUE)::UUID);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (tabela, registro_id, acao, dados_antigos, usuario_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), current_setting('app.current_user_id', TRUE)::UUID);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Aplicar auditoria em tabelas críticas
CREATE TRIGGER audit_membros AFTER INSERT OR UPDATE OR DELETE ON membros
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_lancamentos AFTER INSERT OR UPDATE OR DELETE ON lancamentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- =============================================
-- VIEWS ÚTEIS
-- =============================================

-- View de membros com informações completas
CREATE OR REPLACE VIEW vw_membros_completo AS
SELECT
  m.*,
  i.nome as igreja_nome,
  i.tipo as igreja_tipo,
  COALESCE(
    json_agg(
      json_build_object('funcao', mf.funcao, 'nivel', mf.nivel)
    ) FILTER (WHERE mf.funcao IS NOT NULL),
    '[]'
  ) as funcoes
FROM membros m
LEFT JOIN igrejas i ON i.id = m.igreja_id
LEFT JOIN membros_funcoes mf ON mf.membro_id = m.id AND mf.ativo = TRUE
GROUP BY m.id, i.nome, i.tipo;

-- View de estatísticas financeiras por mês
CREATE OR REPLACE VIEW vw_financeiro_mensal AS
SELECT
  igreja_id,
  EXTRACT(YEAR FROM data) as ano,
  EXTRACT(MONTH FROM data) as mes,
  tipo,
  SUM(valor) as total,
  COUNT(*) as quantidade
FROM lancamentos_financeiros
WHERE status = 'efetivado'
GROUP BY igreja_id, ano, mes, tipo;

-- View de frequência por membro
CREATE OR REPLACE VIEW vw_frequencia_membros AS
SELECT
  m.id as membro_id,
  m.nome,
  m.igreja_id,
  COUNT(f.id) as total_presencas,
  COUNT(f.id) FILTER (WHERE f.presente = TRUE) as presencas,
  COUNT(f.id) FILTER (WHERE f.presente = FALSE) as faltas,
  ROUND(
    (COUNT(f.id) FILTER (WHERE f.presente = TRUE)::NUMERIC / NULLIF(COUNT(f.id), 0) * 100),
    2
  ) as percentual_presenca
FROM membros m
LEFT JOIN frequencias f ON f.membro_id = m.id
WHERE m.status = 'ativo'
GROUP BY m.id, m.nome, m.igreja_id;

-- =============================================
-- DADOS INICIAIS
-- =============================================

-- Categorias financeiras padrão
INSERT INTO categorias_financeiras (nome, tipo, cor, icone) VALUES
  ('Dízimos', 'entrada', '#22c55e', 'dollar-sign'),
  ('Ofertas', 'entrada', '#3b82f6', 'heart'),
  ('Doações', 'entrada', '#8b5cf6', 'gift'),
  ('Eventos', 'entrada', '#f59e0b', 'calendar'),
  ('Aluguel', 'saida', '#ef4444', 'home'),
  ('Água', 'saida', '#06b6d4', 'droplet'),
  ('Luz', 'saida', '#eab308', 'zap'),
  ('Internet', 'saida', '#6366f1', 'wifi'),
  ('Material de Limpeza', 'saida', '#84cc16', 'spray-can'),
  ('Material de Escritório', 'saida', '#a855f7', 'file-text'),
  ('Manutenção', 'saida', '#f97316', 'wrench'),
  ('Salários', 'saida', '#14b8a6', 'users'),
  ('Combustível', 'saida', '#ec4899', 'fuel'),
  ('Missões', 'saida', '#0ea5e9', 'send');

-- =============================================
-- FIM DO SCHEMA INICIAL
-- =============================================
