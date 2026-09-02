import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function verifyAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado', status: 401 }
  const service = createServiceClient()
  const { data: adminUser } = await service.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  if (!adminUser) return { error: 'Acesso negado', status: 403 }
  return { service }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const auth = await verifyAdmin(supabase)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zaapply.com.br'

  const { data: companies } = await auth.service
    .from('companies')
    .select('id, name')
    .eq('is_active', true)
    .eq('is_shadow_company', false)
    .order('name')

  const { data: trialConfigs } = await auth.service
    .from('trial_configs')
    .select('company_id, webhook_token, trial_days_default, test_mode, test_phone')

  const configMap = new Map((trialConfigs ?? []).map((c: any) => [c.company_id, c]))

  const configs = (companies ?? []).map((c: any) => {
    const tc = configMap.get(c.id)
    const token = tc?.webhook_token ?? null
    return {
      company_id: c.id,
      company_name: c.name,
      webhook_token: token,
      trial_days_default: tc?.trial_days_default ?? 7,
      test_mode: tc?.test_mode ?? false,
      test_phone: tc?.test_phone ?? null,
      webhook_url: token ? `${baseUrl}/api/trial/webhook/${token}` : null,
      form_url: token ? `${baseUrl}/trial/${token}` : null,
    }
  }).filter((c: any) => c.webhook_token)

  return NextResponse.json({ configs })
}
