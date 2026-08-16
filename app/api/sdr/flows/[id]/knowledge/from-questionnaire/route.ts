import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { IMUTABLE_BLOCKS, interpolate, type SdrVariables } from '@/lib/sdr/templates'
import { getPlatformConfig } from '@/lib/platform-config'
import { processKnowledgeText } from '@/lib/sdr/rag'
import type OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 120

export interface QuestionnaireAnswers {
  // Conhecimento
  identidade: string       // Quem é o agente e qual é o papel
  produto_contexto: string // O que vende (contexto interno)
  nao_oferece: string      // O que NÃO existe / nunca inventar
  abordagem: string        // Estratégia de vendas (dor first, direto, etc.)
  qualificacao: string     // Perguntas de qualificação em ordem + o que descarta
  proximo_passo: string    // Ação final, link, condição para acionar
  sem_perfil: string       // Como encerrar com lead sem perfil
  precos: string           // Investimento, quando revelar, condições
  chegada: string          // Como leads chegam e o que dizem
  regras: string           // Regras absolutas : nunca fazer/dizer
  // Objeções
  obj_preco: string        // Objeções de preço com gatilho + script + nunca dizer
  obj_tempo: string        // Objeções de tempo/decisão + condicional
  obj_produto: string      // Dúvidas sobre produto com scripts exatos
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
Sua tarefa é escrever a seção dinâmica de um system prompt de SDR com base nas informações do negócio.
Escreva APENAS as seções pedidas : os blocos imutáveis de comportamento são gerados automaticamente pelo sistema.
Use linguagem clara, direta e natural. Scripts devem estar entre aspas. Máximo 3 linhas por mensagem.
O resultado deve ser no nível de qualidade de um prompt de produção profissional.`

  const userPrompt = `Com base nestas informações, escreva a seção dinâmica do system prompt SDR.

=== INFORMAÇÕES DO NEGÓCIO ===
Nome: ${variables.nome_empresa ?? '[nome_empresa]'}
Agente: ${variables.nome_agente ?? '[nome_agente]'}

[IDENTIDADE DO AGENTE]
${answers.identidade}

[PRODUTO/SERVIÇO : contexto interno]
${answers.produto_contexto}

[O QUE NÃO EXISTE : nunca mencionar ou inventar]
${answers.nao_oferece}

[ABORDAGEM DE VENDAS]
${answers.abordagem}

[QUALIFICAÇÃO : perguntas em ordem + o que descarta]
${answers.qualificacao}

[PRÓXIMO PASSO : ação final, link, condição para acionar]
${answers.proximo_passo}

[LEAD SEM PERFIL : como encerrar]
${answers.sem_perfil || 'Não informado : use encerramento cordial padrão'}

[PREÇOS E CONDIÇÕES : o que revelar e quando]
${answers.precos || 'Não informado'}

[COMO O LEAD CHEGA]
${answers.chegada || 'Não informado'}

[REGRAS ABSOLUTAS]
${answers.regras || 'Não informado'}

=== O QUE VOCÊ DEVE ESCREVER ===
Responda em JSON com estas chaves:

{
  "identidade": "Declaração de identidade do agente. Quem é, qual papel, tom. Ex: 'Você é [Nome], especialista comercial da [Empresa]. Você não é um assistente : você é um especialista que qualifica leads e [objetivo]. Tom: direto, caloroso e consultivo.'",

  "o_que_nao_existe": "Lista explícita do que o agente nunca deve mencionar, oferecer ou inventar. Formato: 'NUNCA mencione ou invente: [item1], [item2], [item3]...'",

  "abordagem": "Instrução clara de como abordar. Ex: 'NUNCA apresente benefícios antes de entender a dor. Identifique o problema primeiro. Só posicione a solução depois.' Inclua 2-3 perguntas de dor específicas para o negócio.",

  "qualificacao": "Checklist de qualificação no formato:\nCHECKLIST DE QUALIFICAÇÃO\nUse o raciocínio interno para verificar o que já foi coletado.\nNUNCA repita uma pergunta já respondida.\n[ ] [item1] coletado?\n[ ] [item2] identificado?\n...\nColete UMA informação por vez, na ordem acima.",

  "fluxo": "Fluxo de conversa completo no formato:\nPasso 1 : [nome] (gatilho: lead entrou em contato):\n'[mensagem exata entre aspas]'\n\nPasso 2 : [nome] (gatilho: lead respondeu):\n'[mensagem exata entre aspas]'\n\nPasso 3A : Lead com perfil:\n'[mensagem exata]'\n[condição adicional se houver]\n\nPasso 3B : Lead hesita:\n'[mensagem exata]'\n\n=== REGRAS DE AVANÇO ===\n- Se lead já [contexto] → [ação]\n- Nunca volte etapa já passada\n- Nunca avance sem resposta\nNÃO inclua o passo de fechamento/envio de link aqui : ele vai no campo fechamento.",

  "sem_perfil": "Scripts de encerramento por falta de perfil. Formato:\n[MOTIVO DO ENCERRAMENTO]\n'[script exato]'",

  "regras_absolutas": "Regras no formato:\nREGRAS ABSOLUTAS : NUNCA QUEBRAR\n- [regra 1]\n- [regra 2]\n...",

  "precos": "Bloco de preços no formato:\n[PREÇOS E PLANOS]\nGatilhos: \"Quanto custa?\" / \"Qual o valor?\" / \"Tem outros planos?\"\n[Descreva os planos com valores exatos, condições de revelação e regras. Se não informado, omita este bloco.]",

  "fechamento": "Passo de fechamento com o link exato. Formato obrigatório:\n=== FECHAMENTO ===\nGatilhos: \"quero me inscrever\" / \"como faço para garantir\" / \"qual o link\" / [intenção clara de compra]\n'[mensagem de fechamento]'\n[link EXATO copiado literalmente do campo PRÓXIMO PASSO : nunca altere um caractere da URL]\nATENÇÃO: copie os links EXATAMENTE como fornecidos. Não resuma, não parafraseie, não omita nenhuma URL.",

  "objetivo_final": "3-5 bullet points: '- [objetivo]'"
}

IMPORTANTE: Scripts devem ser realistas, específicos e prontos para uso em WhatsApp. Sem frases genéricas.`

  const res = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  })

  const rawContent = res.choices[0]?.message?.content || '{}'
  const finishReason = res.choices[0]?.finish_reason
  if (finishReason === 'length') {
    throw new Error('Resposta da IA truncada por limite de tokens. Reduza a quantidade de detalhes e tente novamente.')
  }

  let generated: {
    identidade: string
    o_que_nao_existe: string
    abordagem: string
    qualificacao: string
    fluxo: string
    sem_perfil: string
    precos: string
    fechamento: string
    regras_absolutas: string
    objetivo_final: string
  }
  try {
    generated = JSON.parse(rawContent)
  } catch {
    console.error('[generateConhecimento] conteúdo não é JSON válido:', rawContent.slice(0, 300))
    throw new Error('Falha ao interpretar resposta da IA')
  }

  const vars = variables
  const interp = (s: string) => interpolate(s, vars)

  // Monta a seção dinâmica : os blocos imutáveis são embedados depois, intocados
  return `=== AGENTE ${vars.nome_agente ?? '{{nome_agente}}'} : ${vars.nome_empresa ?? '{{nome_empresa}}'} ===

## IDENTIDADE
${generated.identidade}

${generated.o_que_nao_existe}

${interp(blocks.ORDEM_EXECUCAO)}
${interp(blocks.CHECKLIST_BASE)}
${interp(blocks.DETECCAO_BOT)}
${interp(blocks.ANTI_REPETICAO)}

## ABORDAGEM DE VENDAS
${generated.abordagem}

${generated.qualificacao}

=== FLUXO INBOUND ===
${generated.fluxo}

${generated.fechamento ? generated.fechamento + '\n' : ''}
=== ENCERRAMENTO POR FALTA DE PERFIL ===
${generated.sem_perfil}

${generated.precos ? generated.precos + '\n' : ''}${generated.regras_absolutas}

=== FOLLOW-UP ===
Prazo: 24h se lead demonstrou interesse mas não avançou : usar apenas UMA VEZ.
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
Escreva scripts de objeção IMUTÁVEIS : o agente deve copiar e enviar EXATAMENTE como escrito.
Cada script: máximo 3 linhas, linguagem natural de WhatsApp, valide antes de redirecionar.
O formato deve ser rigoroso: gatilhos, script correto, o que nunca dizer, condicionais.`

  const userPrompt = `Escreva a base de scripts de objeções para este negócio com base nas informações fornecidas.

=== INFORMAÇÕES DO NEGÓCIO ===
Nome: ${variables.nome_empresa ?? '[nome_empresa]'}

[LINKS OFICIAIS : use EXATAMENTE estes, nunca invente ou altere um caractere]
Link de teste/demonstração: ${variables.link_teste || 'NÃO INFORMADO : não inclua link de teste em nenhum script, apenas ofereça agendar ou tirar dúvida'}
Link de playlist/tutoriais: ${variables.link_playlist || 'NÃO INFORMADO : omita'}

[OBJEÇÕES DE PREÇO E VALOR]
${answers.obj_preco}

[OBJEÇÕES DE TEMPO E DECISÃO]
${answers.obj_tempo}

[DÚVIDAS SOBRE PRODUTO/SERVIÇO]
${answers.obj_produto}

=== FORMATO OBRIGATÓRIO PARA CADA SCRIPT ===
"[NOME DA OBJEÇÃO EM CAPS]"
Gatilhos: "frase gatilho 1" / "frase gatilho 2" / "frase gatilho 3"
✅ CORRETO : envie EXATAMENTE assim:
"[linha 1]
[linha 2]
[linha 3]"
❌ ERRADO : NUNCA envie assim:
"[exemplo de paráfrase proibida]"
[Se houver condicional: Se lead [condição] → envie EXATAMENTE assim: "[script de continuação]"]

=== O QUE ESCREVER ===
1. Scripts baseados nas objeções reais informadas acima : mantenha os gatilhos e scripts exatos fornecidos
2. Acrescente estas objeções padrão se não estiverem cobertas:
   - [VOU PENSAR] : com urgência real, sem pressão
   - [CARO / MUITO CARO] : valide, contextualize valor, redirecione para teste/ação
   - [NÃO TENHO TEMPO] : valide, ofereça facilitar
   - [JÁ USO OUTRA COISA] : investigue sem rebater
   - [NÃO SEI SE PRECISO] : normalize, redirecione para teste/ação sem pressão
3. Se recusar 2x → script de encerramento cordial

⚠️ PROIBIDO inventar, adivinhar ou "completar" qualquer URL. Use SOMENTE os links informados na seção [LINKS OFICIAIS] acima, copiados caractere por caractere. Se um link não foi informado, não o mencione em nenhum script.

Responda em JSON: { "scripts": "todos os scripts no formato acima, um após o outro" }`

  const res = await openai.chat.completions.create({
    model: 'gpt-4.1',
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 4096,
    response_format: { type: 'json_object' },
  })

  const rawContent = res.choices[0]?.message?.content || '{}'
  const finishReason = res.choices[0]?.finish_reason
  if (finishReason === 'length') {
    throw new Error('Resposta da IA truncada por limite de tokens. Reduza a quantidade de detalhes e tente novamente.')
  }

  let generated: { scripts: string }
  try {
    generated = JSON.parse(rawContent)
  } catch {
    console.error('[generateObjecoes] conteúdo não é JSON válido:', rawContent.slice(0, 300))
    throw new Error('Falha ao interpretar resposta da IA')
  }

  if (!generated.scripts?.trim()) {
    throw new Error('IA não retornou scripts de objeções. Tente novamente.')
  }

  const vars = variables
  const interp = (s: string) => interpolate(s, vars)

  return `${interp(blocks.OBJ_HEADER)}

=== SCRIPTS DE OBJEÇÕES ===

${generated.scripts}

=== REGRA GERAL DE OBJEÇÃO ===
Nunca rebater diretamente. Sempre validar antes de redirecionar.
Se recusar duas vezes → encerre EXATAMENTE assim: "Entendi! 😊
Se mudar de ideia, pode me chamar. Qualquer coisa tô aqui."
${interp(blocks.OBJ_FOOTER)}`
}
