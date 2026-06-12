import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/sdr/conversations — lista conversas da instância WhatsApp atual
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

    let baseQuery = service
      .from('conversas_do_whatsapp')
      .select(`*, lead:leads!conversas_do_whatsapp_id_do_lead_fkey(*, lead_tags(tag_id, tags(id, tag_name, tag_color)))`)
      .eq('company_id', userData.company_id)
      .order('hora_da_ultima_mensagem', { ascending: false })
      .limit(50)

    // Closer só vê conversas dos seus leads atribuídos
    if (userData.role === 'closer') {
      baseQuery = (baseQuery as any).eq('lead.user_id', userData.user_id)
    }

    const { data, error } = await baseQuery
    if (error) throw error

    return NextResponse.json({ conversations: data ?? [], instanceName })
  } catch (err: any) {
    console.error('[SDR conversations]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
