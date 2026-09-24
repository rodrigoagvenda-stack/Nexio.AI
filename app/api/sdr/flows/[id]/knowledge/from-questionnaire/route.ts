import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { SdrVariables } from '@/lib/sdr/templates'
import { getPlatformConfig } from '@/lib/platform-config'
import { processKnowledgeText } from '@/lib/sdr/rag'
import { generateConhecimento, generateObjecoes, type QuestionnaireAnswers } from '@/lib/sdr/questionnaire'

export const runtime = 'nodejs'
export const maxDuration = 120

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
    const { type, answers, variables } = body as {
      type: 'conhecimento' | 'objecoes'
      answers: QuestionnaireAnswers
      variables: SdrVariables
    }

    // Validação dos campos obrigatórios por tipo
    if (type === 'conhecimento') {
      const required = ['identidade', 'produto_contexto', 'nao_oferece', 'abordagem', 'qualificacao', 'proximo_passo'] as const
      const missing = required.filter((k) => !answers[k]?.trim())
      if (missing.length) {
        return NextResponse.json({ error: `Blocos obrigatórios incompletos: ${missing.join(', ')}` }, { status: 400 })
      }
    } else {
      const required = ['obj_preco', 'obj_tempo', 'obj_produto'] as const
      const missing = required.filter((k) => !answers[k]?.trim())
      if (missing.length) {
        return NextResponse.json({ error: `Blocos obrigatórios incompletos: ${missing.join(', ')}` }, { status: 400 })
      }
    }

    const platformConfig = await getPlatformConfig()
    const openaiKey = platformConfig?.openai_api_key
    if (!openaiKey) {
      return NextResponse.json(
        { error: 'Chave OpenAI não configurada. Vá em Admin → Configurações de Plataforma.' },
        { status: 422 }
      )
    }

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: openaiKey })

    let generatedText: string

    if (type === 'conhecimento') {
      generatedText = await generateConhecimento(openai, answers, variables)
    } else {
      generatedText = await generateObjecoes(openai, answers, variables)
    }

    const result = await processKnowledgeText({
      companyId: userData.company_id,
      flowId: params.id,
      filename: `${type}_monte-o-seu.txt`,
      text: generatedText,
      tableType: type,
      companyName: variables.nome_empresa ?? null,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err: any) {
    console.error('[knowledge/from-questionnaire]', err)
    if (err.message?.includes('timeout') || err.code === 'ECONNRESET') {
      return NextResponse.json(
        { error: 'Tempo limite excedido. Verifique se a chave OpenAI está configurada corretamente e tente novamente.' },
        { status: 504 }
      )
    }
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

