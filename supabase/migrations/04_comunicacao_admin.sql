-- ────────────────────────────────────────────────────────────────
-- Migration 04: Comunicação (WhatsApp SDR) + Admin configuracoes
-- ────────────────────────────────────────────────────────────────

-- Coluna de configurações na tabela igrejas (OpenAI, uazapi, etc.)
ALTER TABLE igrejas
  ADD COLUMN IF NOT EXISTS configuracoes JSONB DEFAULT '{}'::jsonb;

-- ── Contatos (membros + visitantes externos ao sistema) ──────────
CREATE TABLE IF NOT EXISTS contatos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id       UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  membro_id       UUID REFERENCES membros(id) ON DELETE SET NULL,
  nome            TEXT NOT NULL,
  telefone        TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'membro'
                  CHECK (tipo IN ('membro','visitante','convertido','externo')),
  foto_url        TEXT,
  origem          TEXT DEFAULT 'manual',  -- manual | escala | culto | formulario
  observacoes     TEXT,
  ativo           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contatos_igreja ON contatos(igreja_id);
CREATE INDEX IF NOT EXISTS idx_contatos_membro ON contatos(membro_id);
CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON contatos(telefone);

-- ── Conversas WhatsApp ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversas_whatsapp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id       UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  contato_id      UUID REFERENCES contatos(id) ON DELETE SET NULL,
  telefone        TEXT NOT NULL,
  nome_contato    TEXT,
  status          TEXT NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta','aguardando','respondida','encerrada')),
  tipo_fluxo      TEXT DEFAULT NULL
                  CHECK (tipo_fluxo IN ('escala','pastoral','visitante','convertido',NULL)),
  ia_ativa        BOOLEAN DEFAULT FALSE,
  ultima_mensagem TEXT,
  ultima_msg_at   TIMESTAMPTZ,
  nao_lidas       INT DEFAULT 0,
  resumo_ia       TEXT,         -- resumo gerado pela IA após conversa
  alertas_enviados JSONB DEFAULT '[]'::jsonb,  -- pastores notificados
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversas_igreja ON conversas_whatsapp(igreja_id);
CREATE INDEX IF NOT EXISTS idx_conversas_contato ON conversas_whatsapp(contato_id);
CREATE INDEX IF NOT EXISTS idx_conversas_status ON conversas_whatsapp(status);

-- ── Mensagens WhatsApp ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensagens_whatsapp (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id     UUID NOT NULL REFERENCES conversas_whatsapp(id) ON DELETE CASCADE,
  direcao         TEXT NOT NULL CHECK (direcao IN ('entrada','saida')),
  conteudo        TEXT NOT NULL,
  tipo            TEXT DEFAULT 'texto' CHECK (tipo IN ('texto','imagem','audio','botao','lista','documento')),
  status          TEXT DEFAULT 'enviado' CHECK (status IN ('enviado','entregue','lido','falhou','pendente')),
  ia_gerada       BOOLEAN DEFAULT FALSE,
  metadata        JSONB DEFAULT '{}'::jsonb,  -- dados extras (botões, listas, etc.)
  msg_id_wpp      TEXT,         -- ID da mensagem no WhatsApp
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens_whatsapp(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created ON mensagens_whatsapp(created_at DESC);

-- ── Relatórios da IA SDR ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS relatorios_sdr (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id       UUID NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
  conversa_id     UUID REFERENCES conversas_whatsapp(id) ON DELETE SET NULL,
  contato_id      UUID REFERENCES contatos(id) ON DELETE SET NULL,
  tipo_relatorio  TEXT NOT NULL CHECK (tipo_relatorio IN ('escala','pastoral','visitante')),
  resumo          TEXT NOT NULL,
  acoes           JSONB DEFAULT '[]'::jsonb,  -- ações geradas (notificações, alertas)
  pastores_alertados JSONB DEFAULT '[]'::jsonb,
  status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','revisado','arquivado')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relatorios_igreja ON relatorios_sdr(igreja_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_tipo ON relatorios_sdr(tipo_relatorio);

-- ── Triggers de updated_at ────────────────────────────────────────
CREATE TRIGGER trg_contatos_updated_at
  BEFORE UPDATE ON contatos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_conversas_updated_at
  BEFORE UPDATE ON conversas_whatsapp
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Webhook de recebimento de mensagens uazapi ───────────────────
-- Usado em /api/webhooks/uazapi/receber
-- A lógica de processamento IA fica no servidor Next.js
