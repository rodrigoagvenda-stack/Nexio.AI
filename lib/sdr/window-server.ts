import { createServiceClient } from '@/lib/supabase/server'
import { computeWindowState, type WindowState } from './window'

type Supabase = ReturnType<typeof createServiceClient>

/**
 * Marca o momento da primeira resposta do negócio numa conversa vinda de
 * CTWA : é esse instante que dispara a janela real de 72h grátis da Meta.
 * Idempotente — só escreve na primeira vez, chamadas seguintes são no-op.
 */
export async function maybeStampFirstCtwaReply(supabase: Supabase, conversationId: string | number): Promise<void> {
  const { data: conv } = await supabase
    .from('conversas_do_whatsapp')
    .select('ctwa_clid, ctwa_first_reply_at')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv?.ctwa_clid || conv.ctwa_first_reply_at) return

  await supabase
    .from('conversas_do_whatsapp')
    .update({ ctwa_first_reply_at: new Date().toISOString() })
    .eq('id', conversationId)
}

/** Busca os três campos e computa o estado da janela pra uma conversa. */
export async function getWindowStateForConversation(
  supabase: Supabase,
  conversationId: string | number
): Promise<WindowState | null> {
  const { data: conv } = await supabase
    .from('conversas_do_whatsapp')
    .select('ultima_mensagem_inbound_at, ctwa_clid, ctwa_first_reply_at')
    .eq('id', conversationId)
    .maybeSingle()

  if (!conv) return null

  return computeWindowState({
    ultimaMensagemInboundAt: conv.ultima_mensagem_inbound_at,
    ctwaClid: conv.ctwa_clid,
    ctwaFirstReplyAt: conv.ctwa_first_reply_at,
  })
}
