-- Empresa decide UMA VEZ se o produto/serviço dela é recorrente (assinatura,
-- cobra automaticamente todo mês) ou avulso (paga uma vez). Gerar_cobranca
-- lê isso direto da configuração, não deixa mais a IA adivinhar por
-- conversa -- evita cobrar errado (avulso quando devia ser assinatura, ou
-- vice-versa).
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS billing_recurring BOOLEAN NOT NULL DEFAULT false;
