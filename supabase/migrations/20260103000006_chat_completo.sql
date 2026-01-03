-- =====================================================
-- CHAT COMPLETO - Reformulação página de atendimento
-- =====================================================

-- =====================================================
-- 1. CRIAR ENUMs
-- =====================================================

-- Segmento
DO $$ BEGIN
  CREATE TYPE "Segmento" AS ENUM (
    'E-commerce',
    'Saúde/Medicina',
    'Educação',
    'Alimentação',
    'Beleza/Estética',
    'Imobiliária',
    'Advocacia',
    'Consultoria',
    'Tecnologia',
    'Moda/Fashion',
    'Arquitetura',
    'Outros'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Prioridade
DO $$ BEGIN
  CREATE TYPE "Prioridade" AS ENUM (
    'Alta',
    'Média',
    'Baixa'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Fonte de importação
DO $$ BEGIN
  CREATE TYPE "Fonte de importação" AS ENUM (
    'PEG',
    'Linkedin',
    'Interno',
    'Meta Ads',
    'Google Ads',
    'Site/Landing Page',
    'Indicação',
    'WhatsApp',
    'TikTok Ads',
    'E-mail Marketing',
    'Evento/Feira'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Estágio do lead
DO $$ BEGIN
  CREATE TYPE "Estágio do lead" AS ENUM (
    'Lead novo',
    'Em contato',
    'Interessado',
    'Proposta enviada',
    'Fechado',
    'Perdido',
    'Remarketing'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Status do Lead
DO $$ BEGIN
  CREATE TYPE "Status do Lead" AS ENUM (
    'Quente 🔥',
    'Morno 🟡',
    'Frio ❄️'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Cargo (role)
DO $$ BEGIN
  CREATE TYPE "Cargo (role)" AS ENUM (
    'Proprietário/Dono',
    'Gerente Comercial',
    'Vendedor',
    'Representante Comercial',
    'Consultor de Vendas'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- 2. APLICAR ENUMs NAS COLUNAS DA TABELA LEADS
-- =====================================================

-- Adicionar coluna cargo se não existir
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cargo "Cargo (role)";

-- Converter colunas existentes para usar ENUMs
-- (Isso vai falhar se já estiverem usando ENUMs, mas está tudo bem)

DO $$ BEGIN
  ALTER TABLE leads
    ALTER COLUMN segment TYPE "Segmento"
    USING segment::"Segmento";
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE leads
    ALTER COLUMN priority TYPE "Prioridade"
    USING priority::"Prioridade";
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE leads
    ALTER COLUMN import_source TYPE "Fonte de importação"
    USING import_source::"Fonte de importação";
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE leads
    ALTER COLUMN status TYPE "Estágio do lead"
    USING status::"Estágio do lead";
EXCEPTION
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE leads
    ALTER COLUMN nivel_interesse TYPE "Status do Lead"
    USING nivel_interesse::"Status do Lead";
EXCEPTION
  WHEN others THEN null;
END $$;

-- =====================================================
-- 3. CRIAR NOVAS TABELAS
-- =====================================================

-- Reações em mensagens
CREATE TABLE IF NOT EXISTS reactions (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL,
  chat_id INTEGER,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_company ON reactions(company_id);
CREATE INDEX IF NOT EXISTS idx_reactions_chat ON reactions(chat_id);

-- Mensagens agendadas
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER,
  lead_id INTEGER REFERENCES leads(id),
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_company ON scheduled_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_lead ON scheduled_messages(lead_id);

-- Notas da equipe (separado da coluna leads.notes que é do SDR)
CREATE TABLE IF NOT EXISTS chat_notes (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER,
  lead_id INTEGER REFERENCES leads(id),
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_notes_company ON chat_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_notes_lead ON chat_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_chat_notes_author ON chat_notes(author_id);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_company ON tags(company_id);

-- Tags aplicadas em leads
CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by INTEGER REFERENCES users(id),
  PRIMARY KEY (lead_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_tags_company ON lead_tags(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag ON lead_tags(tag_id);

-- Produtos para propostas
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Cards do carrossel de planos
CREATE TABLE IF NOT EXISTS carousel_cards (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  header TEXT NOT NULL,
  body TEXT NOT NULL,
  footer TEXT,
  image_url TEXT,
  button_text TEXT,
  button_action TEXT,
  button_value TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carousel_cards_company ON carousel_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_carousel_cards_sort ON carousel_cards(company_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_carousel_cards_active ON carousel_cards(is_active);

-- Cotações/Propostas enviadas
CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER,
  lead_id INTEGER REFERENCES leads(id),
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(10, 2),
  discount NUMERIC(10, 2) DEFAULT 0,
  total NUMERIC(10, 2),
  observations TEXT,
  status TEXT DEFAULT 'sent',
  message_id TEXT,
  sent_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quotations_company ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_lead ON quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_product ON quotations(product_id);

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

-- Reactions
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reactions_select_policy ON reactions;
CREATE POLICY reactions_select_policy ON reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS reactions_insert_policy ON reactions;
CREATE POLICY reactions_insert_policy ON reactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS reactions_delete_policy ON reactions;
CREATE POLICY reactions_delete_policy ON reactions FOR DELETE USING (true);

-- Scheduled Messages
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scheduled_messages_select_policy ON scheduled_messages;
CREATE POLICY scheduled_messages_select_policy ON scheduled_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS scheduled_messages_insert_policy ON scheduled_messages;
CREATE POLICY scheduled_messages_insert_policy ON scheduled_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS scheduled_messages_update_policy ON scheduled_messages;
CREATE POLICY scheduled_messages_update_policy ON scheduled_messages FOR UPDATE USING (true);

DROP POLICY IF EXISTS scheduled_messages_delete_policy ON scheduled_messages;
CREATE POLICY scheduled_messages_delete_policy ON scheduled_messages FOR DELETE USING (true);

-- Chat Notes
ALTER TABLE chat_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_notes_select_policy ON chat_notes;
CREATE POLICY chat_notes_select_policy ON chat_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS chat_notes_insert_policy ON chat_notes;
CREATE POLICY chat_notes_insert_policy ON chat_notes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS chat_notes_update_policy ON chat_notes;
CREATE POLICY chat_notes_update_policy ON chat_notes FOR UPDATE USING (true);

DROP POLICY IF EXISTS chat_notes_delete_policy ON chat_notes;
CREATE POLICY chat_notes_delete_policy ON chat_notes FOR DELETE USING (true);

-- Tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select_policy ON tags;
CREATE POLICY tags_select_policy ON tags FOR SELECT USING (true);

DROP POLICY IF EXISTS tags_insert_policy ON tags;
CREATE POLICY tags_insert_policy ON tags FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS tags_update_policy ON tags;
CREATE POLICY tags_update_policy ON tags FOR UPDATE USING (true);

DROP POLICY IF EXISTS tags_delete_policy ON tags;
CREATE POLICY tags_delete_policy ON tags FOR DELETE USING (true);

-- Lead Tags
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_tags_select_policy ON lead_tags;
CREATE POLICY lead_tags_select_policy ON lead_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS lead_tags_insert_policy ON lead_tags;
CREATE POLICY lead_tags_insert_policy ON lead_tags FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS lead_tags_delete_policy ON lead_tags;
CREATE POLICY lead_tags_delete_policy ON lead_tags FOR DELETE USING (true);

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_select_policy ON products;
CREATE POLICY products_select_policy ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS products_insert_policy ON products;
CREATE POLICY products_insert_policy ON products FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS products_update_policy ON products;
CREATE POLICY products_update_policy ON products FOR UPDATE USING (true);

DROP POLICY IF EXISTS products_delete_policy ON products;
CREATE POLICY products_delete_policy ON products FOR DELETE USING (true);

-- Carousel Cards
ALTER TABLE carousel_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carousel_cards_select_policy ON carousel_cards;
CREATE POLICY carousel_cards_select_policy ON carousel_cards FOR SELECT USING (true);

DROP POLICY IF EXISTS carousel_cards_insert_policy ON carousel_cards;
CREATE POLICY carousel_cards_insert_policy ON carousel_cards FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS carousel_cards_update_policy ON carousel_cards;
CREATE POLICY carousel_cards_update_policy ON carousel_cards FOR UPDATE USING (true);

DROP POLICY IF EXISTS carousel_cards_delete_policy ON carousel_cards;
CREATE POLICY carousel_cards_delete_policy ON carousel_cards FOR DELETE USING (true);

-- Quotations
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotations_select_policy ON quotations;
CREATE POLICY quotations_select_policy ON quotations FOR SELECT USING (true);

DROP POLICY IF EXISTS quotations_insert_policy ON quotations;
CREATE POLICY quotations_insert_policy ON quotations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS quotations_update_policy ON quotations;
CREATE POLICY quotations_update_policy ON quotations FOR UPDATE USING (true);

DROP POLICY IF EXISTS quotations_delete_policy ON quotations;
CREATE POLICY quotations_delete_policy ON quotations FOR DELETE USING (true);

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chat_notes_updated_at ON chat_notes;
CREATE TRIGGER update_chat_notes_updated_at
  BEFORE UPDATE ON chat_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_carousel_cards_updated_at ON carousel_cards;
CREATE TRIGGER update_carousel_cards_updated_at
  BEFORE UPDATE ON carousel_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
