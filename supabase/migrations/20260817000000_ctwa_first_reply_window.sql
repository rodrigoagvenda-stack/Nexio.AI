-- ============================================================================
-- Modelo de janela em dois eixos (24h serviço + 72h CTWA)
-- window_type/window_expires_at conflavam as duas regras num campo só,
-- calculado uma vez, nunca resetado. ctwa_first_reply_at marca o momento
-- exato em que o SDR/atendente responde pela primeira vez uma conversa
-- vinda de anúncio CTWA — é a partir daí que a janela de 72h realmente
-- começa a contar (não da mensagem do lead).
-- ============================================================================

ALTER TABLE conversas_do_whatsapp
  ADD COLUMN IF NOT EXISTS ctwa_first_reply_at TIMESTAMPTZ;

COMMENT ON COLUMN conversas_do_whatsapp.ctwa_first_reply_at IS
  'Momento da primeira resposta do negócio a uma conversa com ctwa_clid : início real da janela de 72h grátis da Meta.';

-- window_type/window_expires_at ficam como estão (não removidos), mas
-- deixam de ser escritos pelo código a partir desta migration : o estado
-- real da janela passa a ser computado ao vivo via lib/sdr/window.ts, a
-- partir de ultima_mensagem_inbound_at + ctwa_clid + ctwa_first_reply_at.
