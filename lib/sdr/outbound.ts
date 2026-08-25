/**
 * Outbound (disparo frio) : port do fluxo n8n "Follow Outbound V2.0" pra código.
 *
 * Diferenças propositais em relação ao n8n original:
 * - Sem tool-calling/4 sub-agentes : só uma chamada de IA (geração da mensagem),
 *   o resto (limites, campanha, conversa) é CRUD direto.
 * - Rate limit por hora corrigido : rolling window real via `outbound_campaigns`,
 *   não staticData em memória (que nunca resetava entre dias no n8n).
 * - Sem checagem de horário comercial em runtime : o próprio agendamento do
 *   cron (pg_cron `outbound-trigger`, 11h/13h/16h/18h/20h seg-sex) já é o gate.
 * - Anti-ban: sem wait de 45-300s por lead (inviável em função serverless).
 *   Confia em: poucas janelas fixas por dia, teto por hora, teto diário por
 *   número, e no delay de digitação já embutido em `sendRichStepUnified`.
 * - Canal uazapi OU Meta (via `sendRichStepUnified`), não só uazapi.
 *
 * Gatilho de criação de campanha continua sendo o trigger de banco
 * `trigger_auto_campaign` em `leads` (status='Outbound') : este módulo só
 * consome campanhas que já existem em `outbound_campaigns`.
 */

import OpenAI from 'openai'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOpenAIKey } from './rag'
import { sendRichStepUnified } from './rich-sender'
import { syslog } from '@/lib/logger'

type Supabase = ReturnType<typeof createServiceClient>

const HOURLY_CAP = 30
const LEADS_PER_COMPANY_PER_TICK = 40
const OUTBOUND_MODEL = 'gpt-4.1-mini'

interface Abertura {
  id: number
  categoria: string
  texto: string
}

// Pool de 100 aberturas, portado 1:1 do node "Abordagem Aleatoria" do n8n.
// Usadas só como inspiração pro prompt de geração : a IA reescreve, nunca copia literalmente.
const ABERTURAS: Abertura[] = [
  { id: 1, categoria: 'Curiosidade', texto: 'Oi [Nome]! Vi algo aqui que me fez pensar direto em você — posso te mostrar em 2 minutos?' },
  { id: 2, categoria: 'Curiosidade', texto: 'Acabei de descobrir uma forma que [segmento] tá usando pra dobrar resultado sem aumentar custo. Você já ouviu falar?' },
  { id: 3, categoria: 'Curiosidade', texto: '[Nome], tenho uma pergunta rápida que pode mudar como você vê [área do negócio]. Posso te fazer ela?' },
  { id: 4, categoria: 'Curiosidade', texto: 'Tem algo acontecendo no mercado de [nicho] que a maioria ainda não sabe. Você tem 1 min?' },
  { id: 5, categoria: 'Curiosidade', texto: 'Vi que você atua com [segmento]. Posso te contar o que os top players tão fazendo diferente?' },
  { id: 6, categoria: 'Curiosidade', texto: '[Nome], você sabia que 80% dos [profissão] estão perdendo dinheiro por um detalhe simples?' },
  { id: 7, categoria: 'Curiosidade', texto: 'Acabei de sair de uma reunião com [perfil similar] e o resultado foi surpreendente. Como você lida com [dor]?' },
  { id: 8, categoria: 'Curiosidade', texto: 'Oi [Nome]! Tenho uma informação que pode ser valiosa pra você — ou não. Mas acho que vale 2 minutos.' },
  { id: 9, categoria: 'Curiosidade', texto: 'Você já parou pra calcular quanto [problema] te custa por mês? A resposta costuma surpreender.' },
  { id: 10, categoria: 'Curiosidade', texto: '[Nome], existe um padrão que toda empresa que cresce rápido em [nicho] tem em comum. Posso te mostrar?' },
  { id: 11, categoria: 'Prova Social', texto: 'Oi [Nome]! A [empresa similar] usou nossa solução e teve [resultado] em 30 dias. Faz sentido conversar?' },
  { id: 12, categoria: 'Prova Social', texto: 'Trabalhei com 3 empresas de [nicho] esse mês e todas tinham o mesmo problema. Você também passa por isso?' },
  { id: 13, categoria: 'Prova Social', texto: '[Nome], um cliente meu com perfil parecido ao seu saiu de [X] para [Y] em 60 dias. Posso te contar como?' },
  { id: 14, categoria: 'Prova Social', texto: 'Seu concorrente já tá usando isso. Você ainda não conhece?' },
  { id: 15, categoria: 'Prova Social', texto: 'Oi [Nome]! Acabei de ajudar uma [tipo de empresa] a resolver [problema]. Você tem esse mesmo desafio?' },
  { id: 16, categoria: 'Prova Social', texto: 'Nesse mês já ajudei [X] empresas de [nicho] com [solução]. Posso ver se faz sentido pra você também?' },
  { id: 17, categoria: 'Prova Social', texto: '[Nome], tenho cases de [segmento] com resultados que vão te surpreender. Vale uma conversa rápida?' },
  { id: 18, categoria: 'Prova Social', texto: 'Nossa solução foi adotada por [X] empresas de [nicho] só esse trimestre. Posso te mostrar por quê?' },
  { id: 19, categoria: 'Prova Social', texto: 'Vi que você está crescendo em [área]. Empresas no mesmo momento usaram [solução] pra escalar mais rápido.' },
  { id: 20, categoria: 'Prova Social', texto: 'Oi [Nome]! Um [cargo similar] que conheço dobrou [resultado] em 45 dias com uma mudança simples. Posso compartilhar?' },
  { id: 21, categoria: 'Dor', texto: '[Nome], você sente que [dor específica] toma mais tempo do que devia no seu dia?' },
  { id: 22, categoria: 'Dor', texto: 'Oi! Sei que [problema] é uma pedra no sapato pra maioria das empresas de [nicho]. É o seu caso?' },
  { id: 23, categoria: 'Dor', texto: '[Nome], como você tá lidando com [desafio]? Pergunto porque tenho visto muita gente travada nisso.' },
  { id: 24, categoria: 'Dor', texto: 'Você já perdeu [tempo/dinheiro/cliente] por causa de [problema]? Isso é mais comum do que parece.' },
  { id: 25, categoria: 'Dor', texto: 'Oi [Nome]! Qual é o maior obstáculo hoje pra você chegar em [objetivo]?' },
  { id: 26, categoria: 'Dor', texto: 'Muita gente de [segmento] me fala que [dor] ainda é manual e consome muito. Na sua empresa também é assim?' },
  { id: 27, categoria: 'Dor', texto: '[Nome], se você pudesse eliminar [dor] hoje, o que isso mudaria no seu resultado?' },
  { id: 28, categoria: 'Dor', texto: 'Sabe aquela sensação de [problema frustrante]? Tenho uma solução que já eliminou isso pra vários clientes.' },
  { id: 29, categoria: 'Dor', texto: 'Oi! Você está no controle de [processo] ou ainda depende de [fator de risco]?' },
  { id: 30, categoria: 'Dor', texto: '[Nome], o que mais trava o crescimento de [empresa/área] hoje pra você?' },
  { id: 31, categoria: 'Valor Direto', texto: 'Oi [Nome]! Tenho algo que pode te economizar [X horas] por semana — posso te mostrar em 5 minutos?' },
  { id: 32, categoria: 'Valor Direto', texto: '[Nome], tenho uma proposta que pode gerar [resultado tangível] sem precisar de grande investimento. Faz sentido ver?' },
  { id: 33, categoria: 'Valor Direto', texto: 'E se você pudesse [resultado desejado] em metade do tempo que leva hoje? Isso é o que nossos clientes estão conseguindo.' },
  { id: 34, categoria: 'Valor Direto', texto: 'Oi! Posso te mostrar como reduzir [custo/problema] em [X]% com uma mudança que leva menos de uma semana?' },
  { id: 35, categoria: 'Valor Direto', texto: '[Nome], estou ajudando empresas de [nicho] a [resultado claro]. Vale 15 minutos da sua agenda?' },
  { id: 36, categoria: 'Valor Direto', texto: 'Tenho algo específico pra quem quer [objetivo]. Você está nesse momento agora?' },
  { id: 37, categoria: 'Valor Direto', texto: 'Oi [Nome]! Imagina [resultado positivo] sem precisar de [esforço/custo atual]. Posso te mostrar como?' },
  { id: 38, categoria: 'Valor Direto', texto: '[Nome], o que você acha de [resultado específico] em [prazo realista]? Tenho um caminho claro pra isso.' },
  { id: 39, categoria: 'Valor Direto', texto: 'Você está deixando [X valor/oportunidade] na mesa sem saber. Posso te mostrar onde?' },
  { id: 40, categoria: 'Valor Direto', texto: 'Oi! Nosso método já gerou [resultado] pra empresas como a sua. Tenho 3 minutos pra te explicar como funciona?' },
  { id: 41, categoria: 'Personalização', texto: 'Oi [Nome]! Vi o post que você fez sobre [assunto] — fez total sentido com o que trabalho. Posso te contar?' },
  { id: 42, categoria: 'Personalização', texto: '[Nome], pesquisei um pouco sobre [empresa] e identifiquei algo que pode fazer diferença pra vocês. Posso compartilhar?' },
  { id: 43, categoria: 'Personalização', texto: 'Vi que sua empresa está [crescendo/expandindo/contratando]. Esse é exatamente o momento certo pra gente conversar.' },
  { id: 44, categoria: 'Personalização', texto: 'Oi [Nome]! Li sobre [conquista da empresa] — parabéns! Aproveitei pra pensar em como posso contribuir com esse crescimento.' },
  { id: 45, categoria: 'Personalização', texto: '[Nome], você e eu temos contatos em comum: [nome]. Ele achou que faria sentido a gente trocar uma ideia.' },
  { id: 46, categoria: 'Personalização', texto: 'Acompanho o trabalho de [empresa] e admiro muito [algo específico]. Tenho algo que pode somar.' },
  { id: 47, categoria: 'Personalização', texto: 'Oi! Vi que você tem desafios parecidos com outros [cargos similares] que atendo. Posso te contar o que funcionou?' },
  { id: 48, categoria: 'Personalização', texto: '[Nome], parece que você está no momento de [transição/crescimento]. Tenho algo relevante pra esse exato estágio.' },
  { id: 49, categoria: 'Personalização', texto: 'Oi [Nome]! Fui indicado por [nome] que disse que você é exatamente quem precisa conhecer isso.' },
  { id: 50, categoria: 'Personalização', texto: 'Vi que você atua em [cidade/região]. Tenho algo que está funcionando muito bem nesse mercado especificamente.' },
  { id: 51, categoria: 'Urgência', texto: '[Nome], tem uma janela de oportunidade em [nicho] que não vai durar muito. Você está olhando pra isso?' },
  { id: 52, categoria: 'Urgência', texto: 'Oi! Estou com uma condição especial disponível só até [data]. Faz sentido te contar?' },
  { id: 53, categoria: 'Urgência', texto: '[Nome], o mercado de [nicho] tá mudando rápido. Quem agir agora vai ter vantagem. Você está preparado?' },
  { id: 54, categoria: 'Urgência', texto: 'Acabamos de abrir [X] vagas para [solução]. Se isso faz sentido pra você, vale conversar antes de fechar.' },
  { id: 55, categoria: 'Urgência', texto: 'Oi [Nome]! Esse é literalmente o melhor momento pra [ação]. Em 3 meses vai ser tarde.' },
  { id: 56, categoria: 'Urgência', texto: '[Nome], estou ajudando um número limitado de empresas esse mês. Você se encaixa no perfil — faz sentido conversar?' },
  { id: 57, categoria: 'Urgência', texto: 'Vi que [mudança de mercado/lei/tendência] vai impactar [segmento] em breve. Você já está se preparando?' },
  { id: 58, categoria: 'Urgência', texto: 'Oi! Temos uma condição que não vai se repetir. Não quero que você perca sem pelo menos saber o que é.' },
  { id: 59, categoria: 'Urgência', texto: '[Nome], seus concorrentes já estão se movendo. O que você está esperando pra agir?' },
  { id: 60, categoria: 'Urgência', texto: 'A janela pra [vantagem competitiva] está aberta agora. Em [X meses] vai ser muito mais caro ou difícil.' },
  { id: 61, categoria: 'Pergunta Poderosa', texto: '[Nome], se você pudesse resolver um problema hoje no seu negócio, qual seria?' },
  { id: 62, categoria: 'Pergunta Poderosa', texto: 'Oi! O que te impede de [resultado desejado] hoje?' },
  { id: 63, categoria: 'Pergunta Poderosa', texto: '[Nome], quanto você está investindo atualmente em [área] e qual o retorno que está tendo?' },
  { id: 64, categoria: 'Pergunta Poderosa', texto: 'Se eu te mostrasse uma forma de [resultado], isso seria relevante pra você agora?' },
  { id: 65, categoria: 'Pergunta Poderosa', texto: 'Oi [Nome]! Qual é a sua meta de [resultado] pros próximos 90 dias?' },
  { id: 66, categoria: 'Pergunta Poderosa', texto: '[Nome], o que você já tentou pra resolver [problema] e por que não funcionou?' },
  { id: 67, categoria: 'Pergunta Poderosa', texto: 'Oi! Numa escala de 1 a 10, o quão satisfeito você está com [área do negócio] hoje?' },
  { id: 68, categoria: 'Pergunta Poderosa', texto: '[Nome], se [problema] não fosse um obstáculo, onde estaria sua empresa hoje?' },
  { id: 69, categoria: 'Pergunta Poderosa', texto: 'Você já calculou quanto [problema] custa pro seu negócio por ano? Posso te ajudar a ver esse número.' },
  { id: 70, categoria: 'Pergunta Poderosa', texto: 'Oi [Nome]! O que precisa acontecer pra [objetivo] virar realidade pra você?' },
  { id: 71, categoria: 'Autoridade', texto: 'Oi [Nome]! Trabalho com [nicho] há [X anos] e consigo identificar rápido o que está travando o crescimento. Posso dar uma olhada no seu caso?' },
  { id: 72, categoria: 'Autoridade', texto: '[Nome], ajudei mais de [X] empresas de [nicho] a [resultado]. Posso ver se faz sentido pra você também?' },
  { id: 73, categoria: 'Autoridade', texto: 'Sou especialista em [área] e consigo te dizer em 10 minutos se existe uma oportunidade concreta no seu negócio.' },
  { id: 74, categoria: 'Autoridade', texto: 'Oi! Fui convidado pra palestrar sobre [tema] justamente por ter resultados consistentes em [área]. Posso compartilhar algo relevante?' },
  { id: 75, categoria: 'Autoridade', texto: '[Nome], já analisei mais de [X] operações de [tipo] e vejo um padrão claro. Posso te mostrar o que separa quem cresce de quem trava?' },
  { id: 76, categoria: 'Autoridade', texto: 'Oi [Nome]! Nossa metodologia foi validada com [X clientes]. Posso te mostrar como aplicar no seu contexto?' },
  { id: 77, categoria: 'Autoridade', texto: '[Nome], desenvolvemos um processo específico pra [nicho] que gera [resultado]. Você tem interesse em conhecer?' },
  { id: 78, categoria: 'Autoridade', texto: 'Trabalho exclusivamente com [segmento]. Isso me dá uma visão que poucos profissionais têm — posso compartilhar?' },
  { id: 79, categoria: 'Autoridade', texto: 'Oi! Tenho um diagnóstico gratuito que já ajudou [X empresas] a identificar onde estão deixando dinheiro na mesa. Interesse?' },
  { id: 80, categoria: 'Autoridade', texto: '[Nome], nossa taxa de sucesso em [nicho] é de [X]%. Isso fala mais do que qualquer pitch que eu poderia fazer.' },
  { id: 81, categoria: 'Conexão Humana', texto: 'Oi [Nome]! A gente tem vários contatos em comum e fiquei curioso pra entender mais sobre o seu trabalho.' },
  { id: 82, categoria: 'Conexão Humana', texto: '[Nome], vi que você passou por [desafio parecido]. Como você resolveu?' },
  { id: 83, categoria: 'Conexão Humana', texto: 'Oi! Não é um pitch — só quero entender melhor como funciona o seu negócio. Você topa uma conversa de 10 min?' },
  { id: 84, categoria: 'Conexão Humana', texto: '[Nome], sempre admiro quem constrói algo em [área]. O que você está construindo agora?' },
  { id: 85, categoria: 'Conexão Humana', texto: 'Oi [Nome]! Estou pesquisando sobre [tema] e você parece ter uma visão real sobre isso. Posso te fazer algumas perguntas?' },
  { id: 86, categoria: 'Conexão Humana', texto: 'Vi que você está num momento importante em [área]. Já passei por isso — posso te contar o que aprendi?' },
  { id: 87, categoria: 'Conexão Humana', texto: '[Nome], tenho aprendido muito com pessoas de [nicho]. Posso trocar uma ideia rápida contigo?' },
  { id: 88, categoria: 'Conexão Humana', texto: 'Oi! Antes de qualquer coisa — quero entender o que você precisa. Pode me contar mais sobre seu negócio?' },
  { id: 89, categoria: 'Conexão Humana', texto: '[Nome], fui indicado pra falar com você porque dizem que você é referência em [área]. Faz sentido trocar uma ideia?' },
  { id: 90, categoria: 'Conexão Humana', texto: 'Oi [Nome]! Sou [seu nome], trabalho com [área] e achei que poderíamos ter uma conversa que vale pra nós dois.' },
  { id: 91, categoria: 'Diferenciação', texto: '[Nome], posso te provar que [solução] funciona antes de você gastar um centavo. Você aceitaria esse desafio?' },
  { id: 92, categoria: 'Diferenciação', texto: 'Oi! A maioria das empresas de [nicho] está errando em [área]. Você quer saber se está nesse grupo?' },
  { id: 93, categoria: 'Diferenciação', texto: '[Nome], tenho certeza que você já ouviu promessas de [resultado]. O que faço é diferente — posso te mostrar por quê?' },
  { id: 94, categoria: 'Diferenciação', texto: 'Oi [Nome]! Não vou te prometer o mundo — mas posso te mostrar algo real e concreto. Você aceita?' },
  { id: 95, categoria: 'Diferenciação', texto: '[Nome], se você está cansado de [solução comum que não funciona], tenho uma abordagem diferente. Posso te apresentar?' },
  { id: 96, categoria: 'Diferenciação', texto: 'Oi! O que fazemos vai contra o convencional — e é exatamente por isso que funciona. Você topa ouvir?' },
  { id: 97, categoria: 'Diferenciação', texto: '[Nome], sei que seu tempo é valioso. Por isso vou direto: tenho algo específico pra [dor]. Faz sentido ouvir?' },
  { id: 98, categoria: 'Diferenciação', texto: 'A maioria das pessoas que vejo em [nicho] está resolvendo [problema] do jeito errado. Você quer saber qual é o jeito certo?' },
  { id: 99, categoria: 'Diferenciação', texto: 'Oi [Nome]! Não vim com um script pronto — vim com uma solução real pra um problema real. Posso te mostrar?' },
  { id: 100, categoria: 'Diferenciação', texto: '[Nome], o que faço não é pra todo mundo. Mas pra quem se encaixa, muda o jogo. Você quer descobrir se é o seu caso?' },
]

interface LeadDisponivel {
  id: number // outbound_campaigns.id
  lead_id: number | null
  contact_name: string
  whatsapp: string
  company_id: number
  tentativas: number
  max_tentativas: number
  template_usado: string | null
  status: string
  proximo_contato_em: string | null
  mensagens_enviadas_hoje: number
  limite_diario: number
  numero_bloqueado: boolean
  msgs_sem_resposta: number
}

export async function runOutboundDispatch(): Promise<{ processed: number; sent: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []
  let processed = 0
  let sent = 0

  const { data: companies } = await supabase
    .from('companies')
    .select('id, features')
    .eq('is_active', true)

  const enabled = (companies ?? []).filter((c: any) => c.features?.outbound === true)

  for (const company of enabled) {
    try {
      sent += await dispatchForCompany(company.id, supabase)
      processed++
    } catch (err: any) {
      errors.push(`Empresa ${company.id}: ${err.message}`)
      await syslog({
        type: 'outbound',
        severity: 'error',
        message: `Outbound error empresa ${company.id}: ${err.message}`,
        company_id: company.id,
        payload: { stack: err.stack?.slice(0, 500) },
      })
    }
  }

  if (sent > 0) {
    await syslog({ type: 'outbound', message: `Outbound: ${sent} mensagens enviadas`, payload: { processed, sent } })
  }

  return { processed, sent, errors }
}

async function dispatchForCompany(companyId: number, supabase: Supabase): Promise<number> {
  const { data: leads } = await supabase
    .from('vw_leads_disponiveis')
    .select('*')
    .eq('company_id', companyId)
    .lte('proximo_contato_em', new Date().toISOString())
    .order('proximo_contato_em', { ascending: true })
    .limit(LEADS_PER_COMPANY_PER_TICK)

  const leadsDisponiveis = (leads ?? []) as LeadDisponivel[]
  if (!leadsDisponiveis.length) return 0

  const leadIds = leadsDisponiveis.map((l) => l.lead_id).filter((id): id is number => id != null)
  const { data: mqlRows } = leadIds.length
    ? await supabase.from('leads').select('id, mql_resumo, nivel_interesse').in('id', leadIds)
    : { data: [] as any[] }
  const mqlById = new Map((mqlRows ?? []).map((r: any) => [r.id, r]))

  const openaiKey = await resolveOpenAIKey(companyId)
  const openai = new OpenAI({ apiKey: openaiKey })

  let sentCount = 0
  for (const lead of leadsDisponiveis) {
    try {
      if (lead.numero_bloqueado) continue
      if (lead.mensagens_enviadas_hoje >= lead.limite_diario) continue

      const mql = lead.lead_id != null ? mqlById.get(lead.lead_id) : null
      if (mql?.nivel_interesse === 'Frio ❄️') continue

      if (!(await withinHourlyRate(companyId, supabase))) break // teto da empresa batido : não adianta tentar o resto do lote agora

      const categoria = lead.tentativas === 0 ? 'primeira_abordagem' : lead.tentativas === 1 ? 'follow_up_1' : 'follow_up_2'
      const template = await fetchTemplate(companyId, categoria, supabase)

      const mensagem = await generateMessage(openai, {
        contactName: lead.contact_name,
        mqlResumo: mql?.mql_resumo ?? null,
        templatePrompt: template?.prompt_sistema ?? null,
      })

      const blocos = mensagem.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
      for (const bloco of blocos) {
        await sendRichStepUnified(companyId, lead.whatsapp, 'text', bloco)
      }

      await persistOutboundMessage(companyId, lead, mensagem, supabase)
      await advanceCampaign(companyId, lead, mensagem, supabase)
      await bumpLimits(companyId, lead.whatsapp, supabase)

      sentCount++
    } catch (err: any) {
      await supabase.from('outbound_campaigns_errors').insert({
        campaign_id: lead.id,
        error_type: 'dispatch',
        error_message: String(err?.message ?? 'erro desconhecido').slice(0, 500),
        whatsapp: lead.whatsapp,
      })
    }
  }
  return sentCount
}

/** Rolling 1h, por empresa : mesma convenção de `withinRateLimit` em lib/sdr/follow.ts */
async function withinHourlyRate(companyId: number, supabase: Supabase): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await supabase
    .from('outbound_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('ultima_abordagem', since)
  return (count ?? 0) < HOURLY_CAP
}

async function fetchTemplate(companyId: number, categoria: string, supabase: Supabase): Promise<{ prompt_sistema: string } | null> {
  const { data } = await supabase
    .from('outbound_templates')
    .select('prompt_sistema')
    .eq('company_id', companyId)
    .eq('categoria', categoria)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  return data
}

async function generateMessage(
  openai: OpenAI,
  ctx: { contactName: string; mqlResumo: string | null; templatePrompt: string | null }
): Promise<string> {
  const abertura = ABERTURAS[Math.floor(Math.random() * ABERTURAS.length)]

  const systemPrompt = `Você é um especialista em prospecção fria via WhatsApp. Gere UMA mensagem curta, natural e personalizada pra iniciar contato com um lead frio.

REGRAS OBRIGATÓRIAS:
- Máximo 40 palavras, máximo 3 linhas
- Sem markdown, sem negrito, sem itálico
- Máximo 1 emoji
- Sem CAIXA ALTA
- Nunca se apresente formalmente ("Olá, sou o assistente virtual da empresa X" é proibido)
- Sem gírias de vendedor genérico, sem slogans
- Linguagem humana e natural, como alguém mandando WhatsApp de verdade : "vc", reticências, vírgulas naturais
- Faça 1 pergunta simples
- Toda frase começa com letra maiúscula
- Use a abordagem abaixo só como INSPIRAÇÃO : nunca copie literalmente, reescreva com as próprias palavras
- Se fizer sentido dividir em duas mensagens curtas, separe os blocos com uma linha em branco (no máximo 2 blocos)

Abordagem de inspiração (categoria: ${abertura.categoria}):
"${abertura.texto}"
${ctx.templatePrompt ? `\nEsqueleto sugerido pela empresa (use como base, nunca copie literalmente):\n${ctx.templatePrompt}` : ''}`

  const userPrompt = `Nome do lead: ${ctx.contactName || 'não informado'}
${ctx.mqlResumo ? `Contexto sobre o lead:\n${ctx.mqlResumo}` : 'Sem contexto adicional sobre o lead : use apenas o nome, se houver.'}

Gere a mensagem agora.`

  const res = await openai.chat.completions.create({
    model: OUTBOUND_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.9,
    max_tokens: 300,
  })

  const text = res.choices[0]?.message?.content?.trim()
  if (!text) throw new Error('IA não retornou mensagem')
  return text
}

async function persistOutboundMessage(companyId: number, lead: LeadDisponivel, mensagem: string, supabase: Supabase): Promise<void> {
  const ts = new Date().toISOString()

  const { data: existing } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', companyId)
    .eq('numero_de_telefone', lead.whatsapp)
    .maybeSingle()

  let conversationId: string
  if (existing?.id) {
    conversationId = String(existing.id)
    await supabase.from('conversas_do_whatsapp').update({
      ultima_mensagem: mensagem,
      hora_da_ultima_mensagem: ts,
    }).eq('id', existing.id)
  } else {
    const { data: created, error } = await supabase
      .from('conversas_do_whatsapp')
      .insert({
        company_id: companyId,
        id_do_lead: lead.lead_id,
        numero_de_telefone: lead.whatsapp,
        nome_do_contato: lead.contact_name,
        ultima_mensagem: mensagem,
        hora_da_ultima_mensagem: ts,
        status_da_conversa: 'aberto',
        contagem_nao_lida: 0,
      })
      .select('id')
      .single()
    if (error || !created?.id) {
      throw new Error(`persistOutboundMessage: falha ao criar conversa: ${error?.message ?? 'id nulo'}`)
    }
    conversationId = String(created.id)
  }

  await supabase.from('mensagens_do_whatsapp').insert({
    company_id: companyId,
    id_da_conversacao: conversationId,
    id_do_lead: lead.lead_id,
    texto_da_mensagem: mensagem,
    tipo_de_mensagem: 'text',
    direcao: 'outbound',
    sender_type: 'ai',
    carimbo_de_data_e_hora: ts,
    nome_do_agente: 'Outbound',
    status: 'sent',
  })
}

async function advanceCampaign(companyId: number, lead: LeadDisponivel, mensagem: string, supabase: Supabase): Promise<void> {
  const now = new Date()
  await supabase
    .from('outbound_campaigns')
    .update({
      status: 'enviado',
      tentativas: lead.tentativas + 1,
      ultima_abordagem: now.toISOString(),
      proximo_contato_em: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      mensagem_enviada: mensagem,
    })
    .eq('id', lead.id)
    .eq('company_id', companyId)
}

/**
 * Opt-out: chamado a partir do webhook inbound (uazapi/Meta) quando o lead
 * pede pra parar de receber mensagem (ver `isOptOutRequest` em engine.ts).
 * Marca o número bloqueado em `outbound_limits` — campo que `vw_leads_disponiveis`
 * já respeita, então o próximo tick do cron já para de tentar esse lead sozinho.
 */
export async function markOptOut(companyId: number, whatsapp: string, motivo: string): Promise<void> {
  const supabase = createServiceClient()
  const { data: existing } = await supabase
    .from('outbound_limits')
    .select('id')
    .eq('company_id', companyId)
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  const payload = {
    numero_bloqueado: true,
    motivo_bloqueio: `opt-out: ${motivo}`.slice(0, 500),
    bloqueado_em: new Date().toISOString(),
  }

  if (existing?.id) {
    await supabase.from('outbound_limits').update(payload).eq('id', existing.id)
  } else {
    await supabase.from('outbound_limits').insert({ company_id: companyId, whatsapp, ...payload })
  }
}

async function bumpLimits(companyId: number, whatsapp: string, supabase: Supabase): Promise<void> {
  const hoje = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('outbound_limits')
    .select('id, ultimo_reset, mensagens_enviadas_hoje')
    .eq('company_id', companyId)
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  if (existing?.id) {
    const resetou = existing.ultimo_reset !== hoje
    await supabase
      .from('outbound_limits')
      .update({
        mensagens_enviadas_hoje: resetou ? 1 : (existing.mensagens_enviadas_hoje ?? 0) + 1,
        ultimo_reset: hoje,
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('outbound_limits').insert({
      company_id: companyId,
      whatsapp,
      mensagens_enviadas_hoje: 1,
      ultimo_reset: hoje,
    })
  }
}
