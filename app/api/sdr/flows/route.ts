import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()
    const { data: flows, error } = await service
      .from('sdr_flows')
      .select('*')
      .eq('company_id', context.companyId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ flows: flows ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()

    const { count } = await service
      .from('sdr_flows')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', context.companyId)

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'Limite de 3 fluxos por empresa atingido' }, { status: 400 })
    }

    const body = await request.json()
    const { nome, descricao, numero_whatsapp, tipo, orchestrator_prompt, conhecimento_ativo, objecoes_ativo, event_title_template } = body

    if (!nome || !tipo) {
      return NextResponse.json({ error: 'nome e tipo são obrigatórios' }, { status: 400 })
    }

    const { data: flow, error } = await service
      .from('sdr_flows')
      .insert({
        company_id: context.companyId,
        nome,
        descricao: descricao ?? null,
        uazapi_instance: '',
        numero_whatsapp: numero_whatsapp ?? '',
        tipo,
        ativo: true,
        orchestrator_prompt: orchestrator_prompt ?? null,
        conhecimento_ativo: conhecimento_ativo ?? true,
        objecoes_ativo: objecoes_ativo ?? false,
        event_title_template: event_title_template ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ flow }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
