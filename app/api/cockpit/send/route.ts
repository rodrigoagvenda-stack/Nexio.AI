import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { sendText as waSendText, sendMedia as waSendMedia, sendLocation as waSendLocation } from '@/lib/sdr/whatsapp-sender'

/**
 * Ponte do Cockpit: o atendimento do Cockpit e so a tela, o envio continua sendo
 * o do motor do Zaapply (mesmo token, mesma pausa do SDR, mesmo registro). Servidor
 * a servidor: o Cockpit se autentica com a service key do banco do Zaapply, que so
 * os dois servidores conhecem.
 */
function authorized(req: NextRequest): boolean {
  const got = req.headers.get('x-cockpit-key') ?? ''
  const want = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!got || !want || got.length !== want.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(want))
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
  try {
    const { companyId, conversationId, message, messageType, mediaUrl, caption, filename, senderName, replyId, replyToText, replyToSender, latitude, longitude, locationName, address } = await req.json()
    if (!companyId || !conversationId) return NextResponse.json({ ok: false, error: 'Dados faltando' }, { status: 400 })
    const type: string = messageType || 'text'
    if (type === 'text' && !String(message ?? '').trim()) return NextResponse.json({ ok: false, error: 'Mensagem vazia' }, { status: 400 })
    if (type === 'location' && !(Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)))) return NextResponse.json({ ok: false, error: 'Localização sem coordenadas' }, { status: 400 })
    if (type !== 'text' && type !== 'location' && !mediaUrl) return NextResponse.json({ ok: false, error: 'Mídia faltando' }, { status: 400 })

    const sb = createServiceClient()
    const { data: conv } = await sb
      .from('conversas_do_whatsapp')
      .select('id, company_id, id_do_lead, numero_de_telefone, ctwa_clid, ctwa_first_reply_at')
      .eq('id', conversationId)
      .eq('company_id', companyId)
      .single()
    if (!conv) return NextResponse.json({ ok: false, error: 'Conversa não encontrada' }, { status: 404 })

    let waId: string | undefined
    if (type === 'location') {
      const r = await waSendLocation({ companyId: Number(companyId), phoneNumber: conv.numero_de_telefone, latitude: Number(latitude), longitude: Number(longitude), name: locationName || undefined, address: address || undefined })
      waId = r?.id
    } else if (type === 'text') {
      const r = await waSendText({ companyId: Number(companyId), phoneNumber: conv.numero_de_telefone, text: message, replyId: replyId || undefined })
      waId = r?.id
    } else {
      const mediaType = type === 'audio' ? 'ptt' : (type as 'image' | 'video' | 'document' | 'ptt')
      const r = await waSendMedia({ companyId: Number(companyId), phoneNumber: conv.numero_de_telefone, type: mediaType, fileUrl: mediaUrl, caption: caption || undefined, filename: filename || undefined, replyId: replyId || undefined })
      waId = r?.id
    }

    const now = new Date().toISOString()
    const fallback = type === 'location' ? `📍 ${[locationName, address].filter(Boolean).join(' · ') || 'Localização'}` : type === 'image' ? '📷 Imagem' : type === 'document' ? '📄 Documento' : type === 'audio' ? '🎵 Áudio' : type === 'video' ? '🎥 Vídeo' : ''
    const row: Record<string, unknown> = {
      company_id: companyId,
      id_da_conversacao: conversationId,
      id_do_lead: conv.id_do_lead ?? null,
      texto_da_mensagem: message || caption || fallback,
      tipo_de_mensagem: type,
      direcao: 'outbound',
      sender_type: 'human',
      nome_do_agente: senderName || null,
      status: 'sent',
      carimbo_de_data_e_hora: now,
      url_da_midia: type === 'location' ? `https://maps.google.com/?q=${Number(latitude)},${Number(longitude)}` : mediaUrl || null,
      whatsapp_message_id: waId || null,
      reply_to_text: replyToText || null,
      reply_to_sender: replyToSender || null,
      source: 'humano',
    }
    if (conv.ctwa_clid && !conv.ctwa_first_reply_at) {
      sb.from('conversas_do_whatsapp').update({ ctwa_first_reply_at: now }).eq('id', conversationId).then(() => {}, () => {})
    }
    // humano respondeu: o SDR para nesta conversa (mesma regra do envio manual do Zaapply)
    const [{ data: saved, error }] = await Promise.all([
      sb.from('mensagens_do_whatsapp').insert(row).select().single(),
      sb.from('conversas_do_whatsapp').update({
        ultima_mensagem: row.texto_da_mensagem,
        hora_da_ultima_mensagem: now,
        contagem_nao_lida: 0,
        agente_pausado: true,
        pause_reason: 'humano_assumiu',
        agente_pausado_em: now,
      }).eq('id', conversationId).eq('company_id', companyId),
    ])
    if (error) throw error
    return NextResponse.json({ ok: true, message: saved })
  } catch (e: any) {
    console.error('[cockpit/send]', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Falha ao enviar' }, { status: 500 })
  }
}
