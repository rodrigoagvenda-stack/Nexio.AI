import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/sdr/flows — lista fluxos da empresa
export async function GET() {
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

    const service = createServiceClient()
    const { data: flows, error } = await service
      .from('sdr_flows')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ flows: flows ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/sdr/flows — cria novo fluxo (máx 3 por empresa)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()

    const { count } = await service
      .from('sdr_flows')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', userData.company_id)

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'Limite de 3 fluxos por empresa atingido' }, { status: 400 })
    }

    const body = await request.json()
    const { nome, descricao, numero_whatsapp, tipo, orchestrator_prompt, conhecimento_ativo, objecoes_ativo } = body

    if (!nome || !tipo) {
      return NextResponse.json({ error: 'nome e tipo são obrigatórios' }, { status: 400 })
    }

    const { data: flow, error } = await service
      .from('sdr_flows')
      .insert({
        company_id: userData.company_id,
        nome,
        descricao: descricao ?? null,
        uazapi_instance: '',
        numero_whatsapp: numero_whatsapp ?? '',
        tipo,
        ativo: true,
        orchestrator_prompt: orchestrator_prompt ?? null,
        conhecimento_ativo: conhecimento_ativo ?? true,
        objecoes_ativo: objecoes_ativo ?? false,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ flow }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
