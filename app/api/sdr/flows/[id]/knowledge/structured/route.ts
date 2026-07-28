import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { processKnowledgeText } from '@/lib/sdr/rag'

export const runtime = 'nodejs'
export const maxDuration = 120

export interface KnowledgeItem {
  pergunta: string
  resposta: string
}

function formatKnowledgeText(items: KnowledgeItem[]): string {
  const header = `=== BASE DE CONHECIMENTO ===\nGerado automaticamente pelo Zaapli SDR.\n\n`
  const body = items
    .filter((i) => i.pergunta.trim() && i.resposta.trim())
    .map((item, idx) => `[ITEM ${idx + 1}]\nPergunta: ${item.pergunta.trim()}\nResposta: ${item.resposta.trim()}`)
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
    const items: KnowledgeItem[] = body.items ?? []

    if (!items.length || !items.some((i) => i.pergunta.trim() && i.resposta.trim())) {
      return NextResponse.json({ error: 'Adicione ao menos um item com pergunta e resposta' }, { status: 400 })
    }

    const text = formatKnowledgeText(items)
    const result = await processKnowledgeText({
      companyId: userData.company_id,
      flowId: params.id,
      filename: 'conhecimento_estruturado.txt',
      text,
      tableType: 'conhecimento',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[knowledge/structured]', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar' }, { status: 500 })
  }
}
