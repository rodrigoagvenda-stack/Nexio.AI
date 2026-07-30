import type OpenAI from 'openai'

export interface ValidationGap {
  id: string
  scenario: string
  severity: 'critica' | 'alta' | 'media'
  what_fails: string
  source: 'Base de Conhecimento' | 'Base de Objeções' | 'Identidade do Agente'
  example: string
  tab_wizard: 'identidade' | 'conhecimento' | 'integracoes' | 'geral'
  suggestion: string
}

export interface ValidationResult {
  score: number
  ready: boolean
  covered: string[]
  gaps: ValidationGap[]
  error?: string
}

// ── Definições estáticas de cada cenário ────────────────────────────────────

export interface ScenarioDef {
  id: string
  title: string
  severity: 'critica' | 'alta' | 'media'
  source: ValidationGap['source']
  tab_wizard: ValidationGap['tab_wizard']
  coveredCriteria: string
  what_fails: string
  example: string
  suggestion: string
}

export const SCENARIO_DEFS: ScenarioDef[] = [
  {
    id: 'C1',
    title: 'Qualificação antes de revelar preço',
    severity: 'critica',
    source: 'Base de Conhecimento',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há instrução explícita de fazer pelo menos uma pergunta diagnóstica (segmento, necessidade, tamanho da equipe etc.) antes de revelar preços ou planos quando o lead abre com saudação genérica ou pedido vago ("olá", "preciso saber mais", "me fala sobre os planos", "me ajuda?").',
    what_fails: 'Lead diz "olá" e o SDR dispara os planos imediatamente — queima a venda antes de entender a necessidade.',
    example: 'Lead: "Me fala sobre os planos"\nSDR: [lista de preços sem qualificar] — lead abandona por falta de contexto',
    suggestion: 'Adicione na Base de Conhecimento um script de abertura com 1-2 perguntas diagnósticas (ex: "Qual é o seu segmento?", "Quantas pessoas usariam?") antes de apresentar qualquer plano ou preço.',
  },
  {
    id: 'C2',
    title: 'Resposta com preço real ao ser perguntado',
    severity: 'critica',
    source: 'Base de Conhecimento',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Quando o lead pergunta "quanto custa?" ou "qual o valor?", o SDR tem um preço real ou faixa de preço para responder — não placeholder como [preco], "entre em contato" ou resposta evasiva.',
    what_fails: 'SDR responde com placeholder "[preco]" ou "entre em contato" — lead perde confiança e abandona.',
    example: 'Lead: "Quanto custa?"\nSDR: "O valor é [preco]" — lead vê o placeholder e perde a confiança',
    suggestion: 'Preencha o campo Preço na aba Identidade ou adicione o valor real na Base de Conhecimento.',
  },
  {
    id: 'C3',
    title: 'CTA claro para lead que quer avançar',
    severity: 'critica',
    source: 'Base de Conhecimento',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há um próximo passo concreto definido (link de agendamento, processo de contratação, ou instrução clara) para quando o lead diz "quero testar", "como contrato?" ou demonstra intenção de avançar.',
    what_fails: 'Lead quer fechar e o SDR não tem próximo passo definido — oportunidade perdida no momento de maior intenção.',
    example: 'Lead: "Quero contratar, como faço?"\nSDR: "Vou verificar e retorno em breve" — lead esfria e abandona',
    suggestion: 'Adicione na Base de Conhecimento o passo a passo de contratação, link de agendamento ou instrução concreta para o próximo passo.',
  },
  {
    id: 'A4',
    title: 'Contorno de objeção de preço',
    severity: 'alta',
    source: 'Base de Objeções',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há script específico para quando o lead diz "tá caro" ou "não tenho esse dinheiro agora" — que reencuadra o valor, menciona parcelamento, teste grátis ou ROI, sem simplesmente repetir o preço.',
    what_fails: 'SDR repete o preço sem reencuadrar ou capitula — lead descarta sem considerar o valor real.',
    example: 'Lead: "Tá caro"\nSDR: [sem resposta definida ou repete o preço] — lead abandona sem entender o valor',
    suggestion: 'Adicione na Base de Objeções um script de reencuadramento de valor (ROI, parcelamento ou período de teste).',
  },
  {
    id: 'A5',
    title: 'Prova social e garantia',
    severity: 'alta',
    source: 'Base de Objeções',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há cases, depoimentos, resultados de clientes ou uma alternativa concreta (trial gratuito, demonstração) para quando o lead pede provas de que o produto funciona ou pede garantia.',
    what_fails: 'SDR não tem prova social — lead pede garantia e o agente não tem resposta, perdendo credibilidade.',
    example: 'Lead: "Me mostra algum caso de sucesso"\nSDR: [sem cases ou depoimentos definidos] — lead não confia',
    suggestion: 'Adicione na Base de Conhecimento pelo menos um case ou depoimento real, ou mencione o período de teste como prova de resultado.',
  },
  {
    id: 'A6',
    title: 'Reconhecimento de sinal de compra',
    severity: 'alta',
    source: 'Base de Conhecimento',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Quando o lead diz "quero fechar", "vamos começar" ou "como assino?" antes do SDR oferecer o CTA, há instrução para o SDR reconhecer imediatamente o sinal e encaminhar o próximo passo sem continuar qualificando.',
    what_fails: 'SDR ignora o sinal de compra e continua qualificando — lead sente fricção e pode desistir no momento decisivo.',
    example: 'Lead: "Quero fechar agora"\nSDR: [continua fazendo perguntas de qualificação] — lead frustra e some',
    suggestion: 'Adicione na Base de Conhecimento instrução para reconhecer sinais de compra e encaminhar imediatamente para o próximo passo sem continuar qualificando.',
  },
  {
    id: 'M7',
    title: 'Objeção de timing ("preciso pensar")',
    severity: 'media',
    source: 'Base de Objeções',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há script para quando o lead diz "preciso pensar", "me dá um tempo" ou "próximo mês vejo" — que valida a decisão, deixa porta aberta e define follow-up sem pressionar.',
    what_fails: 'SDR pressiona imediatamente ou perde o lead sem script de continuação — lead some sem retornar.',
    example: 'Lead: "Preciso pensar"\nSDR: [insiste ou não tem resposta definida] — lead abandona e não volta',
    suggestion: 'Adicione na Base de Objeções um script de adiamento que valida a decisão e propõe um follow-up amigável com prazo definido.',
  },
  {
    id: 'M8',
    title: 'Objeção de autoridade ("preciso consultar")',
    severity: 'media',
    source: 'Base de Objeções',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há script para quando o lead diz "preciso consultar meu sócio" ou "não decido sozinho" — que entende a situação, oferece material para compartilhar e mantém o lead engajado sem pressionar.',
    what_fails: 'SDR aceita passivamente sem estratégia para manter o lead ou incluir o decisor — oportunidade evapora.',
    example: 'Lead: "Preciso falar com meu sócio"\nSDR: "Tudo bem, qualquer coisa me chama" — lead some sem retornar',
    suggestion: 'Adicione na Base de Objeções um script que oferece materiais (resumo, proposta) para o lead compartilhar com o decisor.',
  },
  {
    id: 'M9',
    title: 'Diferencial ante concorrente',
    severity: 'media',
    source: 'Base de Conhecimento',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há pelo menos dois diferenciais concretos do produto versus concorrentes para quando o lead menciona outra solução — sem denigrir o concorrente.',
    what_fails: 'SDR não tem diferenciais definidos — lead compara com concorrente e não vê razão para preferir o produto.',
    example: 'Lead: "Vi que o Sistema X tem isso também"\nSDR: [sem diferencial definido] — lead fica em dúvida e vai embora',
    suggestion: 'Adicione na Base de Conhecimento 2-3 diferenciais competitivos concretos do produto.',
  },
  {
    id: 'M10',
    title: 'Encerramento limpo após confirmação',
    severity: 'media',
    source: 'Base de Conhecimento',
    tab_wizard: 'conhecimento',
    coveredCriteria: 'Há instrução para o SDR enviar uma mensagem curta de encerramento e PARAR de enviar conteúdo após o lead confirmar com "ok", "obrigado" ou "recebi".',
    what_fails: 'SDR continua enviando mensagens após a confirmação do lead — gera irritação e pode levar ao bloqueio.',
    example: 'Lead: "Ok, obrigado"\nSDR: [continua enviando conteúdo promocional] — lead bloqueia o número',
    suggestion: 'Adicione na Base de Conhecimento um script de encerramento curto e instrução explícita para não enviar mais mensagens após confirmação do lead.',
  },
]

// ── Validação estrutural (sem LLM) ────────────────────────────────────────────

export interface StructuralCheck {
  field: string
  filled: boolean
  label: string
  severity: 'critica' | 'alta'
  tab_wizard: 'identidade' | 'conhecimento' | 'integracoes' | 'geral'
}

interface WizardConfig {
  nichoId: string
  agentType: 'atendimento_venda' | 'atendimento_venda_agendamento'
  persona: Record<string, string>
  conhecimentoAtivo: boolean
  objecoesAtivo: boolean
}

const PRODUCT_LINK_NICHES = new Set(['saas', 'ecommerce', 'restaurante', 'generico'])

export function runStructuralChecks(cfg: WizardConfig): StructuralCheck[] {
  const p = cfg.persona
  const checks: StructuralCheck[] = [
    {
      field: 'nome_agente',
      filled: !!p.nome_agente?.trim(),
      label: 'Nome do agente',
      severity: 'critica',
      tab_wizard: 'identidade',
    },
    {
      field: 'empresa',
      filled: !!(p.empresa?.trim() || p.nome_empresa?.trim()),
      label: 'Nome da empresa',
      severity: 'critica',
      tab_wizard: 'identidade',
    },
    {
      field: 'produto',
      filled: !!p.produto?.trim(),
      label: 'Descrição do produto/serviço',
      severity: 'critica',
      tab_wizard: 'identidade',
    },
    {
      field: 'tom',
      filled: !!p.tom?.trim(),
      label: 'Tom de voz do agente',
      severity: 'alta',
      tab_wizard: 'identidade',
    },
  ]

  if (PRODUCT_LINK_NICHES.has(cfg.nichoId)) {
    checks.push({
      field: 'preco',
      filled: !!p.preco?.trim(),
      label: 'Preço do produto/serviço',
      severity: 'alta',
      tab_wizard: 'conhecimento',
    })
  }

  return checks
}

// ── Check único e focado por cenário ─────────────────────────────────────────

async function checkOneScenario(
  def: ScenarioDef,
  builtPrompt: string,
  openaiKey: string,
  OpenAIClass: any
): Promise<{ covered: boolean; reason: string }> {
  const client = new OpenAIClass({ apiKey: openaiKey })
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Você é auditor de SDR WhatsApp. Verifique se o conteúdo do SDR cobre o cenário descrito.
"Coberto" exige instrução EXPLÍCITA ou script que trata o cenário corretamente.
Analise com rigor — "Coberto" não é o padrão; exige evidência clara no texto.
Responda APENAS com JSON válido: {"covered": boolean, "reason": "1 frase curta em português"}`,
      },
      {
        role: 'user',
        content: `CENÁRIO: ${def.title}
CRITÉRIO PARA "COBERTO": ${def.coveredCriteria}

CONTEÚDO DO SDR PARA ANÁLISE:
${builtPrompt}`,
      },
    ],
  })
  const raw = res.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)
  return {
    covered: parsed.covered === true,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  }
}

// Exportado para o recheck-gap route
export async function recheckScenario(
  def: ScenarioDef,
  builtPrompt: string,
  openaiKey: string
): Promise<{ covered: boolean; reason: string }> {
  const { default: OpenAIClass } = await import('openai')
  return checkOneScenario(def, builtPrompt, openaiKey, OpenAIClass)
}

// ── Validação semântica (10 chamadas paralelas e focadas) ─────────────────────

export async function runSemanticValidation(
  builtPrompt: string,
  openaiKey: string,
  agentType: 'atendimento_venda' | 'atendimento_venda_agendamento'
): Promise<Pick<ValidationResult, 'score' | 'covered' | 'gaps'>> {
  const { default: OpenAIClass } = await import('openai')

  // Uma chamada focada por cenário — em paralelo
  const results = await Promise.all(
    SCENARIO_DEFS.map((def) => checkOneScenario(def, builtPrompt, openaiKey, OpenAIClass))
  )

  const covered: string[] = []
  const gaps: ValidationGap[] = []

  SCENARIO_DEFS.forEach((def, i) => {
    if (results[i].covered) {
      covered.push(def.id)
    } else {
      gaps.push({
        id: def.id,
        scenario: def.title,
        severity: def.severity,
        what_fails: def.what_fails,
        source: def.source,
        example: def.example,
        tab_wizard: def.tab_wizard,
        suggestion: def.suggestion,
      })
    }
  })

  const score = Math.round((covered.length / SCENARIO_DEFS.length) * 100)
  return { score, covered, gaps }
}

// ── Orquestrador principal ────────────────────────────────────────────────────

export async function validateSdr(params: {
  builtPrompt: string
  openaiKey: string
  nichoId: string
  agentType: 'atendimento_venda' | 'atendimento_venda_agendamento'
  persona: Record<string, string>
  conhecimentoAtivo: boolean
  objecoesAtivo: boolean
}): Promise<ValidationResult> {
  const { builtPrompt, openaiKey, nichoId, agentType, persona, conhecimentoAtivo, objecoesAtivo } = params

  const structuralChecks = runStructuralChecks({
    nichoId,
    agentType,
    persona,
    conhecimentoAtivo,
    objecoesAtivo,
  })

  const structuralGaps: ValidationGap[] = structuralChecks
    .filter((c) => !c.filled)
    .map((c) => ({
      id: `struct_${c.field}`,
      scenario: `Campo ausente: ${c.label}`,
      severity: c.severity,
      what_fails: `"${c.label}" não preenchido — se o template referenciar esse campo, o SDR responderá com placeholder vazio.`,
      source: c.tab_wizard === 'identidade' ? 'Identidade do Agente' : 'Base de Conhecimento' as ValidationGap['source'],
      example: `SDR: [campo ${c.label} em branco] — resposta incompleta para o lead`,
      tab_wizard: c.tab_wizard,
      suggestion: `Preencha "${c.label}" na aba ${c.tab_wizard === 'identidade' ? 'Identidade' : c.tab_wizard === 'conhecimento' ? 'Conhecimento' : 'Integrações'}.`,
    }))

  try {
    const semantic = await runSemanticValidation(builtPrompt, openaiKey, agentType)

    const penalty = structuralGaps.reduce((acc, g) => acc + (g.severity === 'critica' ? 10 : 5), 0)
    const finalScore = Math.max(0, semantic.score - penalty)

    return {
      score: finalScore,
      ready: finalScore >= 75,
      covered: semantic.covered,
      gaps: [...semantic.gaps, ...structuralGaps],
    }
  } catch (err: any) {
    return {
      score: 0,
      ready: false,
      covered: [],
      gaps: structuralGaps,
      error: err?.message ?? 'Erro ao analisar o prompt do SDR.',
    }
  }
}
