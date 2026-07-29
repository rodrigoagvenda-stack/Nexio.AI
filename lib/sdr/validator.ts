/**
 * Validador pré-ativação do SDR.
 * Duas camadas: estrutural (sem LLM) + semântica (GPT-4o-mini, chamada única na ativação).
 *
 * Cenários baseados em:
 * - SDR Playbook (sdrplaybook.online): BANT, LAER, 8 objeções universais
 * - Moonscale (moonscale.com/blog/why-most-ai-chatbots-fail): 6 failure categories
 * - MKT4EDU (mkt4edu.com/en/blog/sdr-agents-on-whatsapp): WhatsApp SDR mandatory scenarios
 * - Dante AI (dante-ai.com/news/why-ai-chatbots-fail-5-mistakes-to-avoid): 90-day failure rate
 * - Mercado BR: RaiseUp, Leadster, Clint Digital — benchmarks SDR IA WhatsApp 2026
 */

import type OpenAI from 'openai'

export interface ValidationGap {
  id: string
  scenario: string
  severity: 'critica' | 'alta' | 'media'
  what_fails: string
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

// ── Cenários obrigatórios (fonte: pesquisa multi-base 2026) ──────────────────

const MANDATORY_SCENARIOS = `
CENÁRIOS OBRIGATÓRIOS QUE TODO SDR DE VENDAS WHATSAPP DEVE COBRIR:

[C1 - CRÍTICO] Saudação ou pedido genérico de informação sem mencionar preço
Exemplo: "Olá, bom dia", "Preciso saber mais sobre vocês", "Pode me ajudar?", "Me fala sobre os planos"
Comportamento correto: SDR qualifica com uma pergunta diagnóstica antes de revelar qualquer preço ou plano.
Comportamento errado: SDR dispara script de preço ou lista de planos sem qualificar.
Fonte: BANT (Budget, Authority, Need, Timing) — sdrplaybook.online; bug documentado em produção

[C2 - CRÍTICO] Lead pergunta preço explicitamente: "Quanto custa?", "Qual o valor?"
Comportamento correto: SDR responde com o valor real, não com placeholder vazio ou genérico.
Comportamento errado: Resposta diz "[preco]" ou "entre em contato" sem dar um número.

[C3 - CRÍTICO] CTA claro para quando o lead quer avançar: "Quero testar", "Como faço para contratar?"
Comportamento correto: SDR tem próximo passo claro — instrução de agendamento, processo de contratação ou link — para enviar imediatamente.
Comportamento errado: SDR não tem um próximo passo definido após o interesse do lead.

[A4 - ALTA] Objeção de preço: "Tá caro", "Não tenho esse dinheiro agora"
Comportamento correto: SDR reencuadra o valor, menciona teste grátis ou parcelas, não desiste.
Comportamento errado: SDR repete o preço sem reencuadrar ou capitula.
Fonte: LAER framework (Listen, Acknowledge, Explore, Respond) — sdrplaybook.online

[A5 - ALTA] Pedido de prova ou garantia: "Tem depoimento?", "Como sei que funciona?", "Me mostra algum caso"
Comportamento correto: SDR tem cases, depoimentos ou direciona para trial gratuito.
Comportamento errado: SDR não tem social proof e não oferece alternativa.
Fonte: Moonscale — "Damaged Trust: early negative experiences harm credibility"

[A6 - ALTA] Lead quer fechar proativamente antes do SDR oferecer CTA
Exemplo: "Quero fechar", "Vamos começar", "Como faço para assinar?"
Comportamento correto: SDR reconhece o interesse e encaminha o próximo passo imediatamente.
Comportamento errado: SDR continua qualificando ou ignora o sinal de compra.
Fonte: mkt4edu.com — "schedules meeting and forwards qualified lead with context"

[M7 - MÉDIA] Objeção de timing: "Preciso pensar", "Me dá um tempo", "Próximo mês vejo"
Comportamento correto: SDR valida, deixa porta aberta, encaminha sem pressão.
Comportamento errado: SDR insiste imediatamente ou perde o lead sem script de continuação.
Fonte: BANT Timing — "Is there a real deadline or a polite no?" — sdrplaybook.online

[M8 - MÉDIA] Objeção de autoridade: "Preciso consultar meu sócio", "Não decido sozinho"
Comportamento correto: SDR entende, envolve o decisor, não pressiona mas não desiste.
Comportamento errado: SDR aceita passivamente sem estratégia para manter o lead.
Fonte: BANT Authority — "Are you talking to a decision-maker?" — sdrplaybook.online

[M9 - MÉDIA] Comparação com concorrente: "Vi no sistema X que tem isso também"
Comportamento correto: SDR sabe diferenciar sem denigrir o concorrente, tem repositório de diferenciais.
Comportamento errado: SDR não tem resposta e perde o lead por falta de posicionamento.
Fonte: Moonscale — "Insufficient Product Expertise" failure category

[M10 - MÉDIA] Encerramento limpo após confirmação do lead
Exemplo: lead diz "Ok", "Obrigado", "Recebi"
Comportamento correto: SDR envia resposta curta de encerramento e PARA de enviar mensagens.
Comportamento errado: SDR continua enviando conteúdo após a confirmação do lead.
Fonte: Templates validados (ENCERRAMENTO GERAL) — Zaapply produção
`

const VALIDATOR_SYSTEM_PROMPT = `Você é um auditor especializado em agentes SDR de WhatsApp para o mercado brasileiro.
Sua função é analisar o prompt de sistema de um SDR e identificar lacunas em relação a cenários obrigatórios de vendas.

INSTRUÇÃO:
Analise o prompt abaixo e para cada cenário obrigatório decida: está coberto ou não.

CRITÉRIOS:
- "Coberto" significa: o prompt tem instrução EXPLÍCITA ou script que trata esse cenário corretamente.
- "Não coberto" significa: o prompt está AUSENTE, INCOMPLETO ou pode gerar comportamento errado nesse cenário.
- Variáveis com placeholder como [preco], [link_teste] em vez de valores reais = NÃO coberto para o cenário C2.
- Para C1 (pedido vago): verifique se o FLUXO INBOUND faz qualificação antes de revelar preço ou planos.

REGRAS ABSOLUTAS PARA AS SUGESTÕES:
- NUNCA invente valores específicos como preços (ex: "R$ 297", "R$ 99"), links ou datas.
- Nas sugestões, diga apenas o que o usuário deve fazer (ex: "preencha o valor real do produto na aba Conhecimento"), nunca o valor em si.
- Baseie a análise EXCLUSIVAMENTE no texto do prompt fornecido. Não use conhecimento externo sobre o produto ou empresa.

${MANDATORY_SCENARIOS}

Retorne SOMENTE um JSON válido neste formato exato:
{
  "score": <número 0-100>,
  "covered": [<lista de IDs de cenários cobertos, ex: "C1", "C2">],
  "gaps": [
    {
      "id": "<ID do cenário, ex: C1>",
      "scenario": "<nome curto do cenário>",
      "severity": "<critica|alta|media>",
      "what_fails": "<em 1 linha: o que acontece na conversa real quando esse cenário ocorre sem o script>",
      "tab_wizard": "<identidade|conhecimento|integracoes|geral>",
      "suggestion": "<instrução específica e acionável para o usuário corrigir no wizard>"
    }
  ]
}`

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

  // Preço: obrigatório para nichos de produto/SaaS
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

// ── Validação semântica (GPT-4o-mini) ────────────────────────────────────────

export async function runSemanticValidation(
  builtPrompt: string,
  openaiKey: string,
  agentType: 'atendimento_venda' | 'atendimento_venda_agendamento'
): Promise<Pick<ValidationResult, 'score' | 'covered' | 'gaps'>> {
  const { default: OpenAIClass } = await import('openai')
  const client = new OpenAIClass({ apiKey: openaiKey })

  const agendaNote = agentType === 'atendimento_venda_agendamento'
    ? '\nObs: este agente tem agendamento ativo — o SDR agenda diretamente via integração de calendário, sem necessidade de link externo.'
    : ''

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: VALIDATOR_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `PROMPT DO SDR PARA ANÁLISE:${agendaNote}\n\n${builtPrompt}`,
      },
    ],
  })

  const raw = response.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(raw)

  return {
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    covered: Array.isArray(parsed.covered) ? parsed.covered : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
  }
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

  // Camada 1: estrutural (nunca bloqueia — só adiciona gaps informativos)
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
      what_fails: `"${c.label}" não preenchido na persona — se o template referenciar esse campo, o SDR responderá com placeholder vazio.`,
      tab_wizard: c.tab_wizard,
      suggestion: `Preencha "${c.label}" na aba ${c.tab_wizard === 'identidade' ? 'Identidade' : c.tab_wizard === 'conhecimento' ? 'Conhecimento' : 'Integrações'} (ou confirme que está na base de conhecimento).`,
    }))

  // Camada 2: semântica — sempre roda independente dos gaps estruturais
  try {
    const semantic = await runSemanticValidation(builtPrompt, openaiKey, agentType)

    // Gaps estruturais críticos reduzem o score em 10 pts cada; altos em 5 pts
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
