import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { runTenantSelfTest } from '@/lib/sdr/eval'
import { syslog } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 280

// GET/POST /api/cron/sdr-health-check : 1x/dia, roda o autoteste (lib/sdr/eval.ts)
// pra cada empresa real ativa com SDR configurado. Se falhar, grava um aviso
// em activity_logs : o sino (SystemTopBar) já escuta esse canal via Realtime
// por company_id, então aparece sozinho pro dono da empresa, sem UI nova.
async function handler(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('is_active', true)
    .eq('agente_ativo', true)
    .eq('is_shadow_company', false)

  let checked = 0
  let alerted = 0
  const errors: string[] = []

  for (const company of companies ?? []) {
    try {
      const result = await runTenantSelfTest(company.id)
      checked++
      if (!result.passou) {
        await alertCompany(company.id, company.name, result.resumo, supabase)
        alerted++
      }
    } catch (err: any) {
      errors.push(`Empresa ${company.id} (${company.name}): ${err?.message ?? err}`)
    }
  }

  if (alerted > 0 || errors.length > 0) {
    await syslog({
      type: 'sdr_health_check',
      severity: errors.length > 0 ? 'error' : 'warning',
      message: `SDR health check : ${checked} testadas, ${alerted} com aviso, ${errors.length} com erro`,
      payload: { checked, alerted, errors },
    })
  }

  return NextResponse.json({ checked, alerted, errors })
}

async function alertCompany(companyId: number, companyName: string, resumo: string, supabase: ReturnType<typeof createServiceClient>) {
  // activity_logs.user_id é NOT NULL (FK pra auth.users) : não existe "usuário
  // do sistema", então atribui ao admin/dono mais antigo da empresa.
  const { data: owner } = await supabase
    .from('users')
    .select('auth_user_id')
    .eq('company_id', companyId)
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!owner?.auth_user_id) return // sem admin cadastrado : não tem pra quem atribuir o aviso

  await supabase.from('activity_logs').insert({
    user_id: owner.auth_user_id,
    company_id: companyId,
    action: 'sdr_quality_alert',
    description: `Teste automático do SDR encontrou um problema : ${resumo}`,
    metadata: { source: 'sdr-health-check', company_name: companyName },
  })
}

export const GET = handler
export const POST = handler
