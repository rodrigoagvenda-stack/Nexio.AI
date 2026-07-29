import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// PATCH /api/conversations/:id : atualiza status da conversa; dispara CAPI se fechado/ganho
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const convId = parseInt(params.id, 10)
    if (isNaN(convId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await req.json()
    const { status } = body
    if (!status) return NextResponse.json({ error: 'status obrigatório' }, { status: 400 })

    const service = createServiceClient()

    const { data: conv, error: convFetchErr } = await service
      .from('conversas_do_whatsapp')
      .select('id, numero_de_telefone, lead_source, window_type')
      .eq('id', convId)
      .eq('company_id', userData.company_id)
      .single()

    if (convFetchErr || !conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    await service
      .from('conversas_do_whatsapp')
      .update({ status_da_conversa: status })
      .eq('id', convId)

    // Dispara evento CAPI quando fechado com sucesso (fire-and-forget)
    if (status === 'fechado') {
      ;(async () => {
        try {
          const { data: config } = await service
            .from('sdr_configs')
            .select('meta_pixel_id, meta_pixel_token')
            .eq('company_id', userData.company_id)
            .single()

          if (!config?.meta_pixel_id || !config?.meta_pixel_token) return

          const phone = conv.numero_de_telefone?.replace(/\D/g, '') ?? ''
          const ctwaClid = (conv.lead_source as any)?.ctwa_clid ?? undefined
          const phoneHash = phone
            ? crypto.createHash('sha256').update(phone).digest('hex')
            : undefined

          const eventTime = Math.floor(Date.now() / 1000)
          await fetch(
            `https://graph.facebook.com/v21.0/${config.meta_pixel_id}/events?access_token=${config.meta_pixel_token}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                data: [{
                  event_name: 'Purchase',
                  event_time: eventTime,
                  event_id: `zaapply_close_${convId}_${eventTime}`,
                  action_source: 'business_messaging',
                  messaging_channel: 'whatsapp',
                  user_data: {
                    ...(phoneHash ? { ph: [phoneHash] } : {}),
                    ...(ctwaClid ? { ctwa_clid: ctwaClid } : {}),
                  },
                }],
              }),
            }
          )
          console.log(`[CAPI] Purchase disparado : conversa=${convId}`)
        } catch (e: any) {
          console.warn('[CAPI] falha ao disparar evento:', e?.message)
        }
      })()
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[conversations/patch]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/conversations/:id : apaga conversa e todas as mensagens
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const convId = parseInt(params.id, 10)
    if (isNaN(convId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const service = createServiceClient()

    // Verificar que a conversa pertence à empresa do usuário
    const { data: conv } = await service
      .from('conversas_do_whatsapp')
      .select('id')
      .eq('id', convId)
      .eq('company_id', userData.company_id)
      .single()

    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    // 1. Apagar todas as mensagens (service client ignora RLS)
    const { error: msgErr } = await service
      .from('mensagens_do_whatsapp')
      .delete()
      .eq('id_da_conversacao', convId)
      .eq('company_id', userData.company_id)

    if (msgErr) throw msgErr

    // 2. Apagar a conversa
    const { error: convErr } = await service
      .from('conversas_do_whatsapp')
      .delete()
      .eq('id', convId)
      .eq('company_id', userData.company_id)

    if (convErr) throw convErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[conversations/delete]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
