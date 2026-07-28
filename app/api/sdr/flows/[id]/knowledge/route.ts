import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { processKnowledgePdf } from '@/lib/sdr/rag'

export const runtime = 'nodejs'
export const maxDuration = 120

// GET /api/sdr/flows/:id/knowledge — info da base de conhecimento atual
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users').select('company_id').eq('auth_user_id', user.id).single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const service = createServiceClient()
    // Verifica se existe base de conhecimento para este flow
    const { data: docs, count } = await service
      .from('documents')
      .select('metadata', { count: 'exact' })
      .eq('company_id', userData.company_id)
      .contains('metadata', { flow_id: params.id, doc_type: 'conhecimento' })
      .limit(1)

    if (!count) return NextResponse.json({ exists: false })
    const filename = docs?.[0]?.metadata?.filename ?? 'Base de conhecimento'
    return NextResponse.json({ exists: true, filename, chunks: count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/sdr/flows/:id/knowledge — upload PDF base de conhecimento
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    const { data: flow } = await service
      .from('sdr_flows')
      .select('id')
      .eq('id', params.id)
      .eq('company_id', userData.company_id)
      .single()
    if (!flow) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (!file.name.endsWith('.pdf')) return NextResponse.json({ error: 'Apenas arquivos PDF' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB)' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    const result = await processKnowledgePdf({
      companyId: userData.company_id,
      flowId: params.id,
      filename: file.name,
      fileBuffer: buffer,
      tableType: 'conhecimento',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[RAG knowledge upload]', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar PDF' }, { status: 500 })
  }
}
