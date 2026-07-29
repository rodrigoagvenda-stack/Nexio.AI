import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

// POST /api/sdr/fix-gap
// Gera um script específico para corrigir uma lacuna identificada pelo diagnóstico.
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

    // Resolve OpenAI key (mesma cadeia do worker)
    let openaiKey: string | null = null
    if (process.env.OPENAI_API_KEY) {
      openaiKey = process.env.OPENAI_API_KEY
    } else {
      const { data: cfg } = await service
        .from('sdr_configs')
        .select('openai_key')
        .eq('company_id', userData.company_id)
        .single()
      if (cfg?.openai_key) {
        openaiKey = decrypt(cfg.openai_key)
      } else {
        const { data: rows } = await service
          .from('platform_config')
          .select('key, value, is_encrypted')
          .eq('key', 'openai_api_key')
        const row = rows?.[0]
        if (row?.value) openaiKey = row.is_encrypted ? decrypt(row.value) : row.value
      }
    }

    if (!openaiKey) {
      return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 400 })
    }

    const empresaNome = persona?.empresa ?? persona?.nome_empresa ?? 'sua empresa'
    const produto = persona?.produto ?? 'seu produto/serviço'

    const systemPrompt = `Você é um especialista em scripts de vendas para WhatsApp no mercado brasileiro.
Sua tarefa é gerar um script específico e pronto para uso que corrija uma lacuna identificada em um agente SDR.

REGRAS:
- Escreva APENAS o script/conteúdo pronto, sem explicações, sem introdução, sem cabeçalho.
- O script deve ser em português brasileiro, tom WhatsApp (informal mas profissional).
- Use [variavel] apenas se for estritamente necessário e óbvio para o usuário substituir.
- Máximo 5 mensagens curtas no script. Cada mensagem numa linha separada.
- NÃO invente preços, valores ou links — use o que foi informado ou deixe como variável óbvia.
- Foque no cenário exato da lacuna, não em outros cenários.

Contexto do negócio:
- Empresa: ${empresaNome}
- Produto/Serviço: ${produto}`

    const userPrompt = `Lacuna identificada: "${gap.scenario}"
O que falha: ${gap.what_fails}
Onde corrigir: ${gap.source}
Sugestão original: ${gap.suggestion}
Exemplo de falha: ${gap.example}

Gere o script completo que deve ser adicionado na ${gap.source} para corrigir essa lacuna.`

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

    const fix_text = response.choices[0].message.content?.trim() ?? ''

    return NextResponse.json({
      fix_text,
      insert_in: gap.source === 'Base de Objeções' ? 'objecoes' : 'conhecimento',
    })
  } catch (err: any) {
    console.error('[sdr/fix-gap]', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
