-- ── support_tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  protocolo     TEXT UNIQUE NOT NULL,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL,
  assunto       TEXT NOT NULL,
  mensagem      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'aberto'
                CHECK (status IN ('aberto','em_atendimento','respondido','fechado')),
  resposta      TEXT,
  respondido_em TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_company_select" ON support_tickets
  FOR SELECT TO authenticated
  USING (company_id = (
    SELECT company_id FROM members WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "tickets_service_all" ON support_tickets
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── changelogs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS changelogs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'feature'
               CHECK (type IN ('feature','improvement','fix','announcement')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "changelogs_authenticated_select" ON changelogs
  FOR SELECT TO authenticated
  USING (is_published = true);

CREATE POLICY "changelogs_service_all" ON changelogs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Seed inicial
INSERT INTO changelogs (title, description, type, is_published, published_at) VALUES
(
  'Chat de suporte com Zaia',
  'Novo assistente de IA diretamente na página de Ajuda. Zaia responde dúvidas sobre todas as funcionalidades, envia botões de ação rápida e solicita avaliação ao final do atendimento.',
  'feature', true, now() - interval '1 day'
),
(
  'Página de Novidades',
  'Agora você acompanha todas as atualizações, melhorias e correções do Zaapply em tempo real nesta página.',
  'feature', true, now()
),
(
  'Segurança reforçada',
  'Validação JWT server-side via getUser(), headers HTTP de segurança (HSTS, X-Frame-Options, CSP) e rate limiting nas APIs críticas.',
  'improvement', true, now() - interval '3 days'
);
