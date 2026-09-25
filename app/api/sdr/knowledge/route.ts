import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { processKnowledgeText } from '@/lib/sdr/rag'
import { buildText, headerFor, parseTopics } from '@/lib/sdr/knowledge-topics'

export const runtime = 'nodejs'
export const maxDuration = 120

const KINDS = ['conhecimento', 'objecoes'] as const

async function activeFlowId(companyId: number): Promise<string | null> {
  const { data } = await createServiceClient().from('sdr_flows').select('id').eq('company_id', companyId).eq('ativo', true).limit(1).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

// GET /api/sdr/knowledge : a base do agente separada em assuntos editáveis.
export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error
  const flowId = await activeFlowId(context.companyId)
  if (!flowId) return NextResponse.json({ flowId: null, groups: [] })

  const supabase = createServiceClient()
  const groups = await Promise.all(KINDS.map(async (kind) => {
    const { data } = await supabase.from('documents').select('content, metadata, created_at').eq('company_id', context.companyId).contains('metadata', { flow_id: flowId, doc_type: kind }).limit(2000)
    const rows = (data ?? []) as { content: string; metadata: { chunk_index?: number; filename?: string } | null; created_at: string | null }[]
    rows.sort((a, b) => (a.metadata?.chunk_index ?? 0) - (b.metadata?.chunk_index ?? 0))
    const updatedAt = rows.map((r) => r.created_at).filter(Boolean).sort().at(-1) ?? null
    return { kind, filename: rows[0]?.metadata?.filename ?? null, updatedAt, topics: parseTopics(rows.map((r) => r.content)) }
  }))
  return NextResponse.json({ flowId, groups })
}

const putSchema = z.object({
  kind: z.enum(KINDS),
  topics: z.array(z.object({ header: z.string().max(300), title: z.string().min(1).max(120), body: z.string().max(20000) })).min(1).max(300),
})

// PUT /api/sdr/knowledge : grava a versão nova dos assuntos (refaz os trechos e as buscas do agente).
export async function PUT(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error
  const parsed = putSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 422 })
  const { kind, topics } = parsed.data

  const flowId = await activeFlowId(context.companyId)
  if (!flowId) return NextResponse.json({ error: 'Salve a configuração do agente antes de editar a base.' }, { status: 400 })

  const cleaned = topics.map((t) => ({ header: headerFor(t.title, t.header || undefined), title: t.title.trim(), body: t.body.trim() }))
  const tooShort = cleaned.find((t) => t.body.length < 20)
  if (tooShort) return NextResponse.json({ error: `O assunto "${tooShort.title}" está muito curto. Escreva pelo menos uma frase.` }, { status: 400 })
  const text = buildText(cleaned)
  if (text.length > 200_000) return NextResponse.json({ error: 'A base ficou grande demais.' }, { status: 400 })

  const supabase = createServiceClient()
  const [{ data: company }, { data: first }] = await Promise.all([
    supabase.from('companies').select('name').eq('id', context.companyId).maybeSingle(),
    supabase.from('documents').select('metadata').eq('company_id', context.companyId).contains('metadata', { flow_id: flowId, doc_type: kind }).limit(1).maybeSingle(),
  ])
  try {
    const out = await processKnowledgeText({ companyId: context.companyId, flowId, filename: (first?.metadata as { filename?: string } | null)?.filename ?? 'Base de conhecimento', text, tableType: kind, companyName: company?.name ?? null })
    return NextResponse.json({ success: true, chunks: out.chunks })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Não foi possível salvar a base.' }, { status: 500 })
  }
}
