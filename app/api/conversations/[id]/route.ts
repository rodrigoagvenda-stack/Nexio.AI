import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// DELETE /api/conversations/:id — apaga conversa e todas as mensagens
export async function DELETE(
  _req: NextRequest,
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
