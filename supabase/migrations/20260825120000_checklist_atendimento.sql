-- Checklist estruturado de atendimento por conversa. Resolve a amnésia da
-- Zaia depois de ~20 mensagens (getHistory tem limite fixo, e o resumo_ia
-- narrativo prioriza fato novo sobre antigo -- os dois juntos apagam coisa
-- básica tipo "já se apresentou" ou "já perguntei X"). Campo estruturado
-- (booleano/lista) não degrada como texto narrativo e é reinjetado
-- literalmente no prompt a cada turno.
ALTER TABLE conversas_do_whatsapp ADD COLUMN IF NOT EXISTS checklist_atendimento JSONB;
