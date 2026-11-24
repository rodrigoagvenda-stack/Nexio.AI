import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { cockpitCompanyId } from '@/lib/cockpit-bridge'
import { getUazapiForCompany } from '@/lib/sdr/uazapi-for-company'

/**
 * Ponte do Cockpit: editar ou apagar (pra todos) uma mensagem que a equipe mandou.
 * Mesma regra das rotas do Zaapply, mas apagar so marca is_deleted (o historico fica).
 */
export async function POST(req: NextRequest) {
  const companyId = cockpitCompanyId(req)
  if (!companyId) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
  try {
    const { action, messageId, text } = await req.json()
    if (!messageId || (action !== 'edit' && action !== 'delete')) return NextResponse.json({ ok: false, error: 'Dados faltando' }, { status: 400 })
    const sb = createServiceClient()
    const { data: msg } = await sb
      .from('mensagens_do_whatsapp')
      .select('id, direcao, sender_type, tipo_de_mensagem, whatsapp_message_id, id_da_conversacao, is_deleted')
      .eq('id', messageId)
      .eq('company_id', companyId)
      .maybeSingle()
    if (!msg) return NextResponse.json({ ok: false, error: 'Mensagem não encontrada' }, { status: 404 })
    if (msg.direcao !== 'outbound' || msg.sender_type !== 'human') return NextResponse.json({ ok: false, error: 'Só dá pra mexer em mensagem que a equipe mandou.' }, { status: 403 })
    if (msg.is_deleted) return NextResponse.json({ ok: false, error: 'Essa mensagem já foi apagada.' }, { status: 409 })

    const { data: cfg } = await sb.from('sdr_configs').select('whatsapp_provider').eq('company_id', companyId).maybeSingle()
    if (cfg?.whatsapp_provider === 'meta') return NextResponse.json({ ok: false, error: 'O WhatsApp oficial não deixa editar nem apagar mensagem enviada.' }, { status: 400 })
    if (!msg.whatsapp_message_id) return NextResponse.json({ ok: false, error: 'Essa mensagem não tem o código do WhatsApp, não dá pra mexer nela.' }, { status: 400 })

    const uazapi = await getUazapiForCompany(companyId)
    if (action === 'edit') {
      const t = String(text ?? '').trim()
      if (!t) return NextResponse.json({ ok: false, error: 'Mensagem vazia' }, { status: 400 })
      if (msg.tipo_de_mensagem !== 'text') return NextResponse.json({ ok: false, error: 'Só dá pra editar texto.' }, { status: 400 })
      await uazapi.editMessage(msg.whatsapp_message_id, t)
      const { error } = await sb.from('mensagens_do_whatsapp').update({ texto_da_mensagem: t, is_edited: true, edited_at: new Date().toISOString() }).eq('id', messageId).eq('company_id', companyId)
      if (error) throw error
    } else {
      await uazapi.deleteMessage(msg.whatsapp_message_id)
      const { error } = await sb.from('mensagens_do_whatsapp').update({ is_deleted: true }).eq('id', messageId).eq('company_id', companyId)
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[cockpit/message]', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Falha' }, { status: 500 })
  }
}
