import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/conversations/:id/agent — pausar/ativar agente por conversa
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { pausado } = await request.json()
    if (typeof pausado !== 'boolean') {
      return NextResponse.json({ error: 'Campo pausado deve ser boolean' }, { status: 400 })
    }

    const service = createServiceClient()

    const { data, error } = await service
      .from('conversas_do_whatsapp')
      .update({ agente_pausado: pausado })
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .select('id, agente_pausado')
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 })

    return NextResponse.json({ ok: true, agente_pausado: data.agente_pausado })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
