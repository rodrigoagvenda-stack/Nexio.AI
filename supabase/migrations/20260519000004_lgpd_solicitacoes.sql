-- Migration: tabela de solicitações LGPD
-- Criada em: 2026-05-19
-- Propósito: armazenar solicitações de exercício de direitos dos titulares (LGPD Art. 18)

CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
  id           BIGSERIAL     PRIMARY KEY,
  nome         TEXT          NOT NULL,
  email        TEXT          NOT NULL,
  tipo         TEXT          NOT NULL
                CHECK (tipo IN ('acesso', 'correcao', 'exclusao', 'portabilidade', 'revogacao')),
  mensagem     TEXT,
  status       TEXT          NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente', 'em_analise', 'concluido', 'rejeitado')),
  respondido_em TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices para consultas administrativas
CREATE INDEX IF NOT EXISTS lgpd_solicitacoes_email_idx  ON lgpd_solicitacoes (email);
CREATE INDEX IF NOT EXISTS lgpd_solicitacoes_status_idx ON lgpd_solicitacoes (status);
CREATE INDEX IF NOT EXISTS lgpd_solicitacoes_created_at_idx ON lgpd_solicitacoes (created_at DESC);

-- RLS habilitado: apenas service_role pode ler/gravar (acesso via API server-side)
ALTER TABLE lgpd_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Bloqueia acesso anônimo e autenticado — somente service_role bypassa o RLS
CREATE POLICY "lgpd_no_public" ON lgpd_solicitacoes
  FOR ALL
  USING (false);
