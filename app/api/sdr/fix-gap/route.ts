import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'
import { processKnowledgeText } from '@/lib/sdr/rag'

export const runtime = 'nodejs'
export const maxDuration = 60

// POST /api/sdr/fix-gap
// Gera script para a lacuna e embeda diretamente na base correta (sem apagar existente).
export async function POST(req: NextRequest) {
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

    const body = await req.json()
    const { gap, persona } = body

    if (!gap?.id || !gap?.scenario) {
      return NextResponse.json({ error: 'Gap inválido' }, { status: 400 })
    }

    const service = createServiceClient()

    // Busca flow_id e openai_key da empresa
    const { data: cfg } = await service
      .from('sdr_configs')
      .select('flow_id, openai_key')
      .eq('company_id', userData.company_id)
      .single()

    if (!cfg?.flow_id) {
      return NextResponse.json({ error: 'Fluxo SDR não encontrado. Configure o agente primeiro.' }, { status: 400 })
    }

    // Resolve OpenAI key (mesma cadeia do worker)
    let openaiKey: string | null = null
    if (process.env.OPENAI_API_KEY) {
      openaiKey = process.env.OPENAI_API_KEY
    } else if (cfg.openai_key) {
      openaiKey = decrypt(cfg.openai_key)
    } else {
      const { data: rows } = await service
        .from('platform_config')
        .select('key, value, is_encrypted')
        .eq('key', 'openai_api_key')
      const row = rows?.[0]
      if (row?.value) openaiKey = row.is_encrypted ? decrypt(row.value) : row.value
    }

    if (!openaiKey) {
      return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 400 })
    }

    const empresaNome = persona?.empresa ?? persona?.nome_empresa ?? 'sua empresa'
    const produto = persona?.produto ?? 'seu produto/serviço'
    const tableType: 'conhecimento' | 'objecoes' =
      gap.source === 'Base de Objeções' ? 'objecoes' : 'conhecimento'

    // Gera o script via GPT
    const systemPrompt = `Você é um especialista em scripts de vendas para WhatsApp no mercado brasileiro.
Gere um script específico e pronto para uso que resolva a lacuna identificada no agente SDR.

REGRAS:
- Escreva APENAS o script/conteúdo pronto, sem explicações, sem introdução, sem cabeçalho.
- Tom WhatsApp: informal mas profissional.
- Use [variavel] apenas quando for óbvio que o usuário deve substituir.
- Máximo 5 mensagens curtas. Cada mensagem numa linha separada.
- NUNCA invente preços, valores ou links — use o que foi informado ou [variavel].
- Foque EXCLUSIVAMENTE no cenário da lacuna.

Contexto do negócio:
- Empresa: ${empresaNome}
- Produto/Serviço: ${produto}`

    const userPrompt = `Lacuna: "${gap.scenario}"
O que falha: ${gap.what_fails}
Onde será adicionado: ${gap.source}
Instrução: ${gap.suggestion}
Exemplo de falha: ${gap.example}

Gere o script que deve ser adicionado na ${gap.source}.`

    const { default: OpenAIClass } = await import('openai')
    const client = new OpenAIClass({ apiKey: openaiKey })

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const fixText = response.choices[0].message.content?.trim() ?? ''
    if (!fixText) {
      return NextResponse.json({ error: 'Não foi possível gerar o script.' }, { status: 500 })
    }

    // Embeda na base correta — INSERT puro, não apaga nada existente
    const label = gap.source === 'Base de Objeções' ? 'OBJEÇÃO ADICIONADA VIA DIAGNÓSTICO' : 'CONHECIMENTO ADICIONADO VIA DIAGNÓSTICO'
    const docText = `=== ${label} ===\nCenário: ${gap.scenario}\n\n${fixText}`

    await processKnowledgeText({
      companyId: userData.company_id,
      flowId: cfg.flow_id,
      filename: `diagnostico_fix_${gap.id}_${Date.now()}.txt`,
      text: docText,
      tableType,
    })

    return NextResponse.json({ ok: true, fix_text: fixText, insert_in: tableType })
  } catch (err: any) {
    console.error('[sdr/fix-gap]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
