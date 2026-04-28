import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { processKnowledgePdf } from '@/lib/sdr/rag'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST /api/sdr/flows/:id/objections — upload PDF base de objeções
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      tableType: 'objecoes',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[RAG objections upload]', err)
    return NextResponse.json({ error: err.message || 'Erro ao processar PDF' }, { status: 500 })
  }
}
