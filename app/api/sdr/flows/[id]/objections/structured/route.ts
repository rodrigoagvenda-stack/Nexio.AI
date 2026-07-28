import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { processKnowledgeText } from '@/lib/sdr/rag'

export const runtime = 'nodejs'
export const maxDuration = 120

export interface ObjectionItem {
  objecao: string
  resposta: string
  exemplo?: string
}

function formatObjecoesText(items: ObjectionItem[]): string {
  const header = `=== BASE DE OBJEÇÕES ===\nGerado automaticamente pelo Zaapli SDR.\n\n`
  const body = items
    .filter((i) => i.objecao.trim() && i.resposta.trim())
    .map((item, idx) => {
      let block = `[OBJEÇÃO ${idx + 1}]\nObjeção: ${item.objecao.trim()}\nResposta: ${item.resposta.trim()}`
      if (item.exemplo?.trim()) block += `\nExemplo de uso: ${item.exemplo.trim()}`
      return block
    })
    .join('\n\n')
  return header + body
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    const items: ObjectionItem[] = body.items ?? []

    if (!items.length || !items.some((i) => i.objecao.trim() && i.resposta.trim())) {
      return NextResponse.json({ error: 'Adicione ao menos uma objeção com resposta' }, { status: 400 })
    }

    const text = formatObjecoesText(items)
    const result = await processKnowledgeText({
      companyId: userData.company_id,
      flowId: params.id,
      filename: 'objecoes_estruturadas.txt',
      text,
      tableType: 'objecoes',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[objections/structured]', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar' }, { status: 500 })
  }
}
