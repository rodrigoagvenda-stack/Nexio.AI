import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/sdr/conversations : lista conversas da instância WhatsApp atual
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role, user_id')
      .eq('auth_user_id', user.id)
      .single()

    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()

    // Busca instance_name da instância conectada
    const { data: sdrConfig } = await service
      .from('sdr_configs')
      .select('uazapi_instance_name')
      .eq('company_id', userData.company_id)
      .single()

    const instanceName = sdrConfig?.uazapi_instance_name ?? null

    // Ordenado por mensagem mais recente primeiro, igual WhatsApp : achado ao vivo
    // (2026-09-03) que ordenar por lead_score primeiro fazia lead novo (sem score
    // ainda) sumir da lista ou ficar enterrado, mesmo sendo a conversa mais recente.
    let baseQuery = service
      .from('conversas_do_whatsapp')
      .select(`*, lead:leads!conversas_do_whatsapp_id_do_lead_fkey(*, lead_tags(tag_id, tags(id, tag_name, tag_color)))`)
      .eq('company_id', userData.company_id)
      .order('hora_da_ultima_mensagem', { ascending: false, nullsFirst: false })
      .limit(50)

    // Closer só vê conversas dos seus leads atribuídos
    if (userData.role === 'closer') {
      baseQuery = (baseQuery as any).eq('lead.user_id', userData.user_id)
    }

    const { data, error } = await baseQuery
    if (error) throw error

    // Origem real (inbound/outbound) : achado ao vivo (2026-09-03, feedback do
    // Bruno) que a única indicação de origem no card era a badge "Outbound" na
    // 1ª mensagem da conversa, ou o valor de leads.status (que muda com o
    // pipeline e deixa de refletir a origem assim que o lead avança de
    // estágio). outbound_campaigns é a mesma fonte de verdade já usada pro
    // raciocínio da IA (engine.ts) : existe campanha outbound pra esse
    // telefone = outbound, senão inbound. Independe do estágio atual.
    const phones = [...new Set((data ?? []).map((c: any) => c.numero_de_telefone).filter(Boolean))]
    const { data: outboundRows } = phones.length
      ? await service
          .from('outbound_campaigns')
          .select('whatsapp')
          .eq('company_id', userData.company_id)
          .in('whatsapp', phones)
      : { data: [] as { whatsapp: string }[] }
    const outboundPhones = new Set((outboundRows ?? []).map((r) => r.whatsapp))

    const conversations = (data ?? []).map((c: any) => ({
      ...c,
      origem_real: outboundPhones.has(c.numero_de_telefone) ? 'outbound' : 'inbound',
    }))

    return NextResponse.json({ conversations, instanceName })
  } catch (err: any) {
    console.error('[SDR conversations]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
