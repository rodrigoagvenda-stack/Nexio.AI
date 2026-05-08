import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEFAULT_AGENT_PROMPTS } from '@/lib/sdr/default-prompts'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admin_users').select('id').eq('auth_user_id', user.id).eq('is_active', true).single()
  return data ? user : null
}

// GET /api/admin/sdr/:companyId/prompts
export async function GET(_req: NextRequest, { params }: { params: { companyId: string } }) {
  try {
    const supabase = await createClient()
    if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const service = createServiceClient()
    const { data: flow } = await service
      .from('sdr_flows')
      .select('id, agent_prompts, orchestrator_prompt')
      .eq('company_id', params.companyId)
      .eq('ativo', true)
      .limit(1)
      .single()

    return NextResponse.json({
      flow_id: flow?.id ?? null,
      agent_prompts: (flow?.agent_prompts as Record<string, string>) ?? {},
      orchestrator_prompt: flow?.orchestrator_prompt ?? '',
      default_agent_prompts: DEFAULT_AGENT_PROMPTS,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin/sdr/:companyId/prompts
export async function PATCH(request: NextRequest, { params }: { params: { companyId: string } }) {
  try {
    const supabase = await createClient()
    if (!await requireAdmin(supabase)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const body = await request.json()
    const { agent_prompts, orchestrator_prompt } = body

    const service = createServiceClient()
    const companyId = parseInt(params.companyId)

    const { data: flow } = await service
      .from('sdr_flows')
      .select('id')
      .eq('company_id', companyId)
      .eq('ativo', true)
      .limit(1)
      .single()

    if (!flow) return NextResponse.json({ error: 'Fluxo SDR não encontrado para esta empresa' }, { status: 404 })

    const updates: Record<string, any> = {}
    if (agent_prompts !== undefined) updates.agent_prompts = agent_prompts
    if (orchestrator_prompt !== undefined) updates.orchestrator_prompt = orchestrator_prompt

    await service.from('sdr_flows').update(updates).eq('id', flow.id)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
