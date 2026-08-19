-- Peça A (fundação) do plano "máquina de vendas completa":
-- corrige distribution_rules (coluna que a rota já esperava mas não existia),
-- faz backfill de attendants a partir de users pra empresas que só tinham
-- equipe no sistema antigo, sincroniza fechamento conversas_do_whatsapp -> leads
-- (conversas_do_whatsapp é a fonte de verdade nova, leads fica só como espelho),
-- e prepara lead_charges para a recuperação de pagamento (Peça D).

-- 1) distribution_rules: app/api/conversations/distribute/route.ts já fazia
-- .eq('active', true) contra uma coluna que nunca existiu -- toda chamada
-- silenciosamente ignorava a regra configurada e caía no default.
ALTER TABLE distribution_rules
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Linha default por empresa sem regra configurada, pra distribuição funcionar
-- imediatamente após o deploy em vez de depender de configuração manual.
INSERT INTO distribution_rules (company_id, strategy, active)
SELECT c.id, 'by_load', true
FROM companies c
WHERE NOT EXISTS (SELECT 1 FROM distribution_rules dr WHERE dr.company_id = c.id)
ON CONFLICT (company_id) DO NOTHING;

-- 2) Backfill attendants a partir de users ativos -- empresa que só tinha
-- equipe no sistema antigo (users/assigned_to) ganha as mesmas pessoas em
-- attendants, pra não sumir do dropdown de transferência depois do repoint.
INSERT INTO attendants (company_id, user_id, name, email, role, active)
SELECT u.company_id, u.auth_user_id, u.name, u.email,
       CASE
         WHEN u.role IN ('admin', 'company_admin') THEN 'admin'
         WHEN u.role IN ('manager') THEN 'supervisor'
         ELSE 'atendente'
       END,
       true
FROM users u
WHERE u.is_active = true
  AND u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM attendants a WHERE a.company_id = u.company_id AND a.email = u.email
  )
ON CONFLICT (company_id, email) DO NOTHING;

-- 3) Sincronização de mão única conversas_do_whatsapp -> leads: quando a
-- conversa fecha (fonte de verdade nova, tem atribuição/valor), espelha em
-- leads.status pro CRM/Kanban antigo não divergir silenciosamente. Nunca
-- escreve o sentido contrário.
CREATE OR REPLACE FUNCTION sync_lead_close_from_conversa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kanban_stage = 'fechado' AND (OLD.kanban_stage IS DISTINCT FROM 'fechado') THEN
    UPDATE leads
    SET status = 'Fechado',
        closed_at = COALESCE(closed_at, now()),
        project_value = CASE
          WHEN project_value IS NULL OR project_value = 0
          THEN COALESCE(NEW.value_cents / 100.0, project_value)
          ELSE project_value
        END
    WHERE company_id = NEW.company_id
      AND whatsapp = NEW.numero_de_telefone
      AND status IS DISTINCT FROM 'Fechado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_lead_close_from_conversa ON conversas_do_whatsapp;
CREATE TRIGGER trg_sync_lead_close_from_conversa
  AFTER UPDATE OF kanban_stage ON conversas_do_whatsapp
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_close_from_conversa();

-- 4) lead_charges: campo de dedupe pra recuperação de pagamento (Peça D) --
-- evita reenviar lembrete a cada execução do cron pra mesma cobrança parada.
ALTER TABLE lead_charges
  ADD COLUMN IF NOT EXISTS last_recovery_nudge_at TIMESTAMPTZ;
