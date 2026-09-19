import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { validateFunnelConfig } from '@/lib/sdr/funnel/validate'
import { genericFunnelTemplate } from '@/lib/sdr/funnel/templates'

export const runtime = 'nodejs'

const CAN_EDIT = new Set(['admin', 'manager', 'company_admin'])

// GET /api/sdr/funnel : config do funil da empresa + se está ligado.
export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error

  const supabase = createServiceClient()
  const [{ data: row }, { data: company }] = await Promise.all([
    supabase.from('sdr_funnel_configs').select('enabled, config, updated_at').eq('company_id', context.companyId).maybeSingle(),
    supabase.from('companies').select('name, features').eq('id', context.companyId).single(),
  ])
  const features = (company?.features ?? {}) as Record<string, unknown>
  return NextResponse.json({
    success: true,
    data: {
      companyName: company?.name ?? '',
      active: features.sdr_funnel_v2 === true,
      config: row?.config ?? null,
      updatedAt: row?.updated_at ?? null,
    },
  })
}

// PUT /api/sdr/funnel : salva a config (validada) e/ou liga/desliga o funil.
// Body: { config?, active? }. Ligar exige config válida salva.
export async function PUT(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error
  if (!CAN_EDIT.has(context.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão para alterar o funil.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const supabase = createServiceClient()

  if (body.config !== undefined) {
    const errors = validateFunnelConfig(body.config)
    if (errors.length > 0) {
      return NextResponse.json({ success: false, message: errors[0], errors }, { status: 400 })
    }
    const { error: upsertError } = await supabase
      .from('sdr_funnel_configs')
      .upsert({ company_id: context.companyId, enabled: true, config: body.config, updated_at: new Date().toISOString() }, { onConflict: 'company_id' })
    if (upsertError) return NextResponse.json({ success: false, message: upsertError.message }, { status: 500 })
  }

  if (typeof body.active === 'boolean') {
    if (body.active) {
      const { data: row } = await supabase.from('sdr_funnel_configs').select('config').eq('company_id', context.companyId).maybeSingle()
      if (!row || validateFunnelConfig(row.config).length > 0) {
        return NextResponse.json({ success: false, message: 'Salve uma configuração válida antes de ligar o funil.' }, { status: 400 })
      }
    }
    const { data: company } = await supabase.from('companies').select('features').eq('id', context.companyId).single()
    const features = { ...((company?.features ?? {}) as Record<string, unknown>), sdr_funnel_v2: body.active }
    const { error: featError } = await supabase.from('companies').update({ features }).eq('id', context.companyId)
    if (featError) return NextResponse.json({ success: false, message: featError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// POST /api/sdr/funnel : cria a config inicial a partir do modelo genérico
// (só se a empresa ainda não tem). Body: { agentName, humanName }.
export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error
  if (!CAN_EDIT.has(context.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão para alterar o funil.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const agentName = String(body.agentName ?? '').trim().slice(0, 40)
  const humanName = String(body.humanName ?? '').trim().slice(0, 40)
  if (!agentName || !humanName) {
    return NextResponse.json({ success: false, message: 'Informe o nome do seu atendente virtual e o nome de quem assume as conversas.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: existing } = await supabase.from('sdr_funnel_configs').select('company_id').eq('company_id', context.companyId).maybeSingle()
  if (existing) return NextResponse.json({ success: false, message: 'A empresa já tem um funil configurado.' }, { status: 409 })

  const { data: company } = await supabase.from('companies').select('name').eq('id', context.companyId).single()
  const config = genericFunnelTemplate({ agentName, companyName: company?.name ?? 'nossa empresa', humanName })
  const errors = validateFunnelConfig(config)
  if (errors.length > 0) return NextResponse.json({ success: false, message: errors[0] }, { status: 400 })

  // Cria desligado : o cliente revisa os textos antes de ativar.
  const { error: insertError } = await supabase.from('sdr_funnel_configs').insert({ company_id: context.companyId, enabled: true, config })
  if (insertError) return NextResponse.json({ success: false, message: insertError.message }, { status: 500 })
  return NextResponse.json({ success: true, data: { config } })
}
