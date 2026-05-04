import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const service = createServiceClient()
    const { data: adminUser } = await service
      .from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
    if (!adminUser) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const { error } = await service.from('system_logs').insert({
      type: 'system',
      severity: 'info',
      message: 'Log de teste — sistema de logs funcionando corretamente.',
      payload: { triggered_by: 'admin_test', admin_user_id: user.id },
    })

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          ok: false,
          table_missing: true,
          error: 'Tabela system_logs não existe. Execute a migration 20260504000000_system_logs.sql no Supabase.',
        }, { status: 500 })
      }
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
