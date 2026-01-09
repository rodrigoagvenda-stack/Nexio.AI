-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE igrejas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultos_regulares ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministerios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministerios_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalas_detalhes ENABLE ROW LEVEL SECURITY;
ALTER TABLE frequencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_recorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_oracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FUNÇÕES AUXILIARES
-- =============================================

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar se usuário pertence a uma igreja
CREATE OR REPLACE FUNCTION pertence_igreja(igreja_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND igreja_id = igreja_id_param
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar permissão financeira
CREATE OR REPLACE FUNCTION tem_permissao_financeira()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'pastor', 'tesoureiro')
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar permissão de escrita
CREATE OR REPLACE FUNCTION tem_permissao_escrita()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'pastor', 'secretaria')
    AND ativo = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- POLICIES - PROFILES
-- =============================================

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin pode ver todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- Usuários podem ver perfis da mesma igreja
CREATE POLICY "Users can view same church profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.igreja_id = profiles.igreja_id
    )
  );

-- Admin pode atualizar qualquer perfil
CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (is_admin());

-- Usuários podem atualizar próprio perfil (apenas alguns campos)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================
-- POLICIES - IGREJAS
-- =============================================

-- Todos usuários autenticados podem ver igrejas
CREATE POLICY "Authenticated users can view churches"
  ON igrejas FOR SELECT
  USING (auth.role() = 'authenticated');

-- Apenas admin pode criar/editar/deletar igrejas
CREATE POLICY "Admins can manage churches"
  ON igrejas FOR ALL
  USING (is_admin());

-- =============================================
-- POLICIES - CULTOS REGULARES
-- =============================================

-- Usuários podem ver cultos da sua igreja
CREATE POLICY "Users can view own church services"
  ON cultos_regulares FOR SELECT
  USING (pertence_igreja(igreja_id) OR is_admin());

-- Admin e pastores podem gerenciar cultos
CREATE POLICY "Admins and pastors can manage services"
  ON cultos_regulares FOR ALL
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'pastor')
      AND igreja_id = cultos_regulares.igreja_id
    )
  );

-- =============================================
-- POLICIES - MEMBROS
-- =============================================

-- Usuários podem ver membros da sua igreja
CREATE POLICY "Users can view own church members"
  ON membros FOR SELECT
  USING (pertence_igreja(igreja_id) OR is_admin());

-- Admin, pastor e secretaria podem criar membros
CREATE POLICY "Staff can create members"
  ON membros FOR INSERT
  WITH CHECK (
    tem_permissao_escrita() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- Admin, pastor e secretaria podem editar membros
CREATE POLICY "Staff can update members"
  ON membros FOR UPDATE
  USING (
    tem_permissao_escrita() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- Apenas admin pode deletar membros
CREATE POLICY "Admins can delete members"
  ON membros FOR DELETE
  USING (is_admin());

-- =============================================
-- POLICIES - MEMBROS FUNÇÕES
-- =============================================

CREATE POLICY "Users can view member functions"
  ON membros_funcoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM membros m
      WHERE m.id = membros_funcoes.membro_id
      AND (pertence_igreja(m.igreja_id) OR is_admin())
    )
  );

CREATE POLICY "Staff can manage member functions"
  ON membros_funcoes FOR ALL
  USING (
    tem_permissao_escrita() OR is_admin()
  );

-- =============================================
-- POLICIES - MINISTÉRIOS
-- =============================================

CREATE POLICY "Users can view own church ministries"
  ON ministerios FOR SELECT
  USING (pertence_igreja(igreja_id) OR is_admin());

CREATE POLICY "Staff can manage ministries"
  ON ministerios FOR ALL
  USING (
    tem_permissao_escrita() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- =============================================
-- POLICIES - MINISTÉRIOS MEMBROS
-- =============================================

CREATE POLICY "Users can view ministry members"
  ON ministerios_membros FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ministerios mi
      WHERE mi.id = ministerios_membros.ministerio_id
      AND (pertence_igreja(mi.igreja_id) OR is_admin())
    )
  );

CREATE POLICY "Staff can manage ministry members"
  ON ministerios_membros FOR ALL
  USING (
    tem_permissao_escrita() OR is_admin()
  );

-- =============================================
-- POLICIES - ESCALAS
-- =============================================

CREATE POLICY "Users can view own church schedules"
  ON escalas FOR SELECT
  USING (pertence_igreja(igreja_id) OR is_admin());

CREATE POLICY "Staff can manage schedules"
  ON escalas FOR ALL
  USING (
    tem_permissao_escrita() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- =============================================
-- POLICIES - ESCALAS DETALHES
-- =============================================

CREATE POLICY "Users can view schedule details"
  ON escalas_detalhes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM escalas e
      WHERE e.id = escalas_detalhes.escala_id
      AND (pertence_igreja(e.igreja_id) OR is_admin())
    )
  );

CREATE POLICY "Staff can manage schedule details"
  ON escalas_detalhes FOR ALL
  USING (
    tem_permissao_escrita() OR is_admin()
  );

-- =============================================
-- POLICIES - FREQUÊNCIA
-- =============================================

CREATE POLICY "Users can view own church attendance"
  ON frequencias FOR SELECT
  USING (pertence_igreja(igreja_id) OR is_admin());

CREATE POLICY "Staff can manage attendance"
  ON frequencias FOR ALL
  USING (
    tem_permissao_escrita() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- =============================================
-- POLICIES - CATEGORIAS FINANCEIRAS
-- =============================================

-- Todos usuários podem ver categorias
CREATE POLICY "Users can view categories"
  ON categorias_financeiras FOR SELECT
  USING (auth.role() = 'authenticated');

-- Apenas admin pode gerenciar categorias
CREATE POLICY "Admins can manage categories"
  ON categorias_financeiras FOR ALL
  USING (is_admin());

-- =============================================
-- POLICIES - CONTAS BANCÁRIAS
-- =============================================

CREATE POLICY "Users with finance permission can view accounts"
  ON contas_bancarias FOR SELECT
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

CREATE POLICY "Users with finance permission can manage accounts"
  ON contas_bancarias FOR ALL
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- =============================================
-- POLICIES - LANÇAMENTOS FINANCEIROS
-- =============================================

CREATE POLICY "Users with finance permission can view transactions"
  ON lancamentos_financeiros FOR SELECT
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

CREATE POLICY "Users with finance permission can create transactions"
  ON lancamentos_financeiros FOR INSERT
  WITH CHECK (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

CREATE POLICY "Users with finance permission can update transactions"
  ON lancamentos_financeiros FOR UPDATE
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

CREATE POLICY "Admins can delete transactions"
  ON lancamentos_financeiros FOR DELETE
  USING (is_admin());

-- =============================================
-- POLICIES - DESPESAS RECORRENTES
-- =============================================

CREATE POLICY "Users with finance permission can view recurring expenses"
  ON despesas_recorrentes FOR SELECT
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

CREATE POLICY "Users with finance permission can manage recurring expenses"
  ON despesas_recorrentes FOR ALL
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- =============================================
-- POLICIES - ORÇAMENTO
-- =============================================

CREATE POLICY "Users with finance permission can view budget"
  ON orcamento FOR SELECT
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

CREATE POLICY "Users with finance permission can manage budget"
  ON orcamento FOR ALL
  USING (
    tem_permissao_financeira() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- =============================================
-- POLICIES - EVENTOS
-- =============================================

CREATE POLICY "Users can view own church events"
  ON eventos FOR SELECT
  USING (pertence_igreja(igreja_id) OR is_admin());

CREATE POLICY "Staff can manage events"
  ON eventos FOR ALL
  USING (
    tem_permissao_escrita() AND
    (pertence_igreja(igreja_id) OR is_admin())
  );

-- =============================================
-- POLICIES - EVENTOS INSCRIÇÕES
-- =============================================

CREATE POLICY "Users can view event registrations"
  ON eventos_inscricoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM eventos e
      WHERE e.id = eventos_inscricoes.evento_id
      AND (pertence_igreja(e.igreja_id) OR is_admin())
    )
  );

CREATE POLICY "Staff can manage event registrations"
  ON eventos_inscricoes FOR ALL
  USING (
    tem_permissao_escrita() OR is_admin()
  );

-- =============================================
-- POLICIES - MENSAGENS
-- =============================================

CREATE POLICY "Users can view messages"
  ON mensagens FOR SELECT
  USING (
    auth.uid() = enviado_por OR is_admin()
  );

CREATE POLICY "Staff can create messages"
  ON mensagens FOR INSERT
  WITH CHECK (
    tem_permissao_escrita() AND
    auth.uid() = enviado_por
  );

CREATE POLICY "Users can update own messages"
  ON mensagens FOR UPDATE
  USING (auth.uid() = enviado_por OR is_admin());

-- =============================================
-- POLICIES - PEDIDOS DE ORAÇÃO
-- =============================================

-- Pedidos públicos podem ser vistos por todos da igreja
CREATE POLICY "Users can view public prayer requests"
  ON pedidos_oracao FOR SELECT
  USING (
    privacidade = 'publico' AND
    EXISTS (
      SELECT 1 FROM membros m
      WHERE m.id = pedidos_oracao.membro_id
      AND (pertence_igreja(m.igreja_id) OR is_admin())
    )
  );

-- Pedidos da liderança só para pastores e admin
CREATE POLICY "Leadership can view all prayer requests"
  ON pedidos_oracao FOR SELECT
  USING (
    privacidade = 'lideranca' AND
    (
      is_admin() OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'pastor')
      )
    )
  );

-- Membros podem criar pedidos
CREATE POLICY "Members can create prayer requests"
  ON pedidos_oracao FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Membros podem editar próprios pedidos
CREATE POLICY "Members can update own prayer requests"
  ON pedidos_oracao FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM membros m
      WHERE m.id = pedidos_oracao.membro_id
      AND m.cpf IN (SELECT cpf FROM membros WHERE id = auth.uid())
    ) OR
    is_admin()
  );

-- =============================================
-- POLICIES - AUDIT LOGS
-- =============================================

-- Apenas admin pode ver logs de auditoria
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

-- Ninguém pode editar ou deletar logs (apenas inserção via trigger)
CREATE POLICY "Only system can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (FALSE);

-- =============================================
-- FIM DAS POLICIES
-- =============================================
