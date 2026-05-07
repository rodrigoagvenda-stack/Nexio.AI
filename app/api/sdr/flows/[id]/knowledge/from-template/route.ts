import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NICHE_MAP, interpolate, type SdrVariables } from '@/lib/sdr/templates'
import { processKnowledgeText } from '@/lib/sdr/rag'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    const { data: flow } = await service
      .from('sdr_flows').select('id').eq('id', params.id).eq('company_id', userData.company_id).single()
    if (!flow) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

    const body = await request.json()
    const { nicheId, variables } = body as { nicheId: string; variables: SdrVariables }

    const niche = NICHE_MAP[nicheId]
    if (!niche) return NextResponse.json({ error: 'Nicho inválido' }, { status: 400 })

    const missing = niche.requiredVars.filter((k) => !variables[k]?.trim())
    if (missing.length) {
      return NextResponse.json({ error: `Campos obrigatórios faltando: ${missing.join(', ')}` }, { status: 400 })
    }

    const text = interpolate(niche.conhecimento, variables)

    const result = await processKnowledgeText({
      companyId: userData.company_id,
      flowId: params.id,
      filename: `conhecimento_${nicheId}.txt`,
      text,
      tableType: 'conhecimento',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[knowledge/from-template]', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar' }, { status: 500 })
  }
}
