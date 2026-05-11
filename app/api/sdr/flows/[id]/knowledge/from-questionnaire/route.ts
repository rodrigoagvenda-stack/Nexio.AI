import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { IMUTABLE_BLOCKS, interpolate, type SdrVariables } from '@/lib/sdr/templates'
import { getPlatformConfig } from '@/lib/platform-config'
import { processKnowledgeText } from '@/lib/sdr/rag'
import type OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 120

export interface QuestionnaireAnswers {
  identidade: string
  produto: string
  cliente: string
  chegada: string
  proximo_passo: string
  precos: string
  objecoes: string
  limites: string
}

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
    const { type, answers, variables } = body as {
      type: 'conhecimento' | 'objecoes'
      answers: QuestionnaireAnswers
      variables: SdrVariables
    }

    const required = ['identidade', 'produto', 'cliente', 'proximo_passo'] as const
    const missing = required.filter((k) => !answers[k]?.trim())
    if (missing.length) {
      return NextResponse.json({ error: `Blocos obrigatórios incompletos: ${missing.join(', ')}` }, { status: 400 })
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

async function generateConhecimento(
  openai: OpenAI,
  answers: QuestionnaireAnswers,
  variables: SdrVariables
): Promise<string> {
  const blocks = IMUTABLE_BLOCKS

  const systemInstruction = `Você é um especialista em SDR e escrita de system prompts para agentes de WhatsApp.
Sua tarefa é escrever a seção dinâmica de um system prompt de SDR com base nas informações do negócio fornecidas.
Escreva APENAS as seções pedidas — o restante é gerado automaticamente.
Use linguagem clara, direta e natural. Scripts devem estar entre aspas. Máximo 3 linhas por mensagem.`

  const userPrompt = `Com base nestas informações sobre o negócio, escreva o conteúdo dinâmico do system prompt SDR.

=== INFORMAÇÕES DO NEGÓCIO ===
Nome: ${variables.nome_empresa ?? '[nome_empresa]'}
Agente: ${variables.nome_agente ?? '[nome_agente]'}

[Bloco 1 — Identidade]
${answers.identidade}

[Bloco 2 — Produto/Serviço]
${answers.produto}

[Bloco 3 — Cliente Ideal]
${answers.cliente}

[Bloco 4 — Como o lead chega]
${answers.chegada || 'Não informado'}

[Bloco 5 — Próximo Passo]
${answers.proximo_passo}

[Bloco 6 — Preços e Condições]
${answers.precos || 'Não informado'}

[Bloco 8 — Limites do Agente]
${answers.limites || 'Não informado'}

=== O QUE VOCÊ DEVE ESCREVER ===
Responda em JSON com estas chaves:

{
  "papel": "Uma linha descrevendo o papel do agente (ex: 'Qualificação e agendamento — entende a necessidade e agenda avaliação')",

  "info_negocio": "2-3 linhas resumindo o negócio para o agente (usa nome da empresa, o que oferece, diferenciais)",

  "fluxo": "O fluxo completo no formato abaixo:

Passo 1 — [nome do passo] (gatilho: lead entrou em contato):
Responda APENAS com esta mensagem. Nada mais.
\\"[mensagem de abertura exata entre aspas duplas]\\"

Passo 2 — [nome do passo] (gatilho: lead respondeu o Passo 1):
\\"[mensagem de qualificação entre aspas duplas]\\"

Passo 3A — Lead demonstrou interesse:
\\"[mensagem guiando para o próximo passo entre aspas duplas]\\"
[instruções adicionais se houver link ou ação]

Passo 3B — Lead hesita ou tem dúvida:
\\"[mensagem investigando a hesitação entre aspas duplas]\\"

=== REGRAS DE AVANÇO DE ETAPA ===
- Se lead já [contexto] → [ação]
- Se lead já demonstrou interesse claro → ofereça [próximo passo] diretamente
- Nunca volte uma etapa que o lead já passou
- Nunca avance sem aguardar a resposta do lead",

  "encerramento_especifico": "Gatilhos e mensagem de encerramento após conversão (ex: após agendar, comprar, etc.)",

  "objetivo_final": "3-5 bullet points no formato '- [objetivo]' descrevendo o resultado esperado da conversa",

  "regras_especificas": "3-5 regras específicas do negócio que o agente deve seguir (limitações, redirecionamentos, etc.)"
}

IMPORTANTE: Escreva scripts realistas e específicos para esse negócio. Não use frases genéricas.`

  const res = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  })

  let generated: {
    papel: string
    info_negocio: string
    fluxo: string
    encerramento_especifico: string
    objetivo_final: string
    regras_especificas: string
  }
  try {
    generated = JSON.parse(res.choices[0]?.message?.content ?? '{}')
  } catch {
    throw new Error('Falha ao interpretar resposta da IA')
  }

  // Assemble the full CONHECIMENTO prompt with immutable blocks
  const vars = variables
  const interp = (s: string) => interpolate(s, vars)

  return `=== AGENTE ${vars.nome_agente ?? '{{nome_agente}}'} — ${vars.nome_empresa ?? '{{nome_empresa}}'} ===
Papel: ${generated.papel}
Tom: ${vars.tom_agente ?? '{{tom_agente}}'}
Sobre o negócio: ${generated.info_negocio}
${interp(blocks.ORDEM_EXECUCAO)}
${interp(blocks.CHECKLIST_BASE)}
${interp(blocks.DETECCAO_BOT)}
${interp(blocks.ANTI_REPETICAO)}

=== FLUXO INBOUND ===
${generated.fluxo}

=== REGRAS ESPECÍFICAS ===
${generated.regras_especificas}

=== ENCERRAMENTO APÓS CONVERSÃO ===
${generated.encerramento_especifico}

=== FOLLOW-UP ===
Prazo: 24h se lead demonstrou interesse mas não avançou — usar apenas UMA VEZ.
Mensagem: "Oi 😊 Ainda pensando? Qualquer dúvida tô aqui."
Regra: Nunca insistir mais de uma vez.
${interp(blocks.COMPORTAMENTOS_PROIBIDOS_BASE)}
${interp(blocks.TOM_FORMATACAO)}
${interp(blocks.ENCERRAMENTO_GERAL)}

=== OBJETIVO FINAL ===
${generated.objetivo_final}
- Zero output ao detectar mensagem de bot`
}

async function generateObjecoes(
  openai: OpenAI,
  answers: QuestionnaireAnswers,
  variables: SdrVariables
): Promise<string> {
  const blocks = IMUTABLE_BLOCKS

  const systemInstruction = `Você é um especialista em SDR e escrita de scripts de objeções para WhatsApp.
Escreva scripts de objeção IMUTÁVEIS — o agente deve copiar e enviar exatamente como escrito.
Cada script: máximo 3 linhas, linguagem natural de WhatsApp, valide antes de redirecionar.`

  const userPrompt = `Escreva a base de scripts de objeções para este negócio.

=== INFORMAÇÕES DO NEGÓCIO ===
Nome: ${variables.nome_empresa ?? '[nome_empresa]'}

[Identidade]
${answers.identidade}

[Produto/Serviço]
${answers.produto}

[Objeções que o cliente levantou com respostas]
${answers.objecoes || 'Não informado — use as objeções padrão do segmento'}

[Próximo Passo]
${answers.proximo_passo}

[Preços]
${answers.precos || 'Não informado'}

=== FORMATO OBRIGATÓRIO ===
Para cada objeção escreva EXATAMENTE assim:

[NOME EM CAPS]
Gatilhos: "frase gatilho 1", "frase gatilho 2", "frase gatilho 3"
Resposta: "script exato que o agente vai copiar e enviar — máx 3 linhas"

=== O QUE ESCREVER ===
1. Scripts baseados nas objeções reais informadas acima
2. Mais estas objeções padrão obrigatórias:
   - [PREÇO / CARO] — com base nos preços/condições informados
   - [SEM TEMPO] — com redirecionamento para o próximo passo
   - [VOU PENSAR] — ofereça reserva sem compromisso
   - [JÁ TENHO OUTRA OPÇÃO] — abertura para conhecer sem compromisso
   - [NÃO CONHEÇO VOCÊS] — apresente o negócio brevemente

Responda em JSON: { "scripts": "todos os scripts no formato acima, um após o outro" }`

  const res = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: 'json_object' },
  })

  let generated: { scripts: string }
  try {
    generated = JSON.parse(res.choices[0]?.message?.content ?? '{}')
  } catch {
    throw new Error('Falha ao interpretar resposta da IA')
  }

  const vars = variables
  const interp = (s: string) => interpolate(s, vars)

  return `${interp(blocks.OBJ_HEADER)}

=== SCRIPTS DE OBJEÇÕES ===

${generated.scripts}
${interp(blocks.OBJ_FOOTER)}`
}
