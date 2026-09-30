/**
 * SDR v3: decisor (spec seção 4). Função pura: extração + estado + config entram, ação + estado novo saem.
 * Nenhuma regra de negócio depende de o modelo lembrar: a ordem abaixo é a primeira regra que casar.
 */
import type { CompanyConfig, ObjecaoConfig } from './config-types'
import type { Acao, Estado, Etapa, Extracao, Intencao } from './types'

/** Quantas listas de horários o lead recebe antes de ir pra pessoa. */
const LIMITE_OFERTAS_HORARIO = 3

export interface DecisorCtx {
  temCalendario: boolean
  cobrancaAtiva: boolean
  /** true quando ainda não saiu nenhuma mensagem nossa nesta conversa. */
  primeiraMensagemNossa: boolean
  pushName: string | null
  contextoOutbound: string | null
  origemAnuncio: string | null
  /** Data formatada da reunião já agendada e válida (com horário no futuro), se houver. */
  reuniaoExistente: string | null
  /** true quando existe evento real e não cancelado no Calendar, mesmo que o horário já tenha passado
   * (diferente de reuniaoExistente, que só conta reunião com horário no futuro). Usado só pra permitir
   * cancelar: achado real, lead Rodrigo Evangelista/63104, 28/09/2026 — pediu pra cancelar minutos depois
   * do horário marcado já ter passado, e reuniaoExistente (null nesse caso) bloqueava a regra de cancelar. */
  temReuniaoAtiva: boolean
  /** A última mensagem nossa antes desta resposta do lead foi uma automação (follow-up, remarketing, promoção,
   * anti no-show). O estado do v3 não sabe disso (a automação roda por fora dele), então sem este sinal o SDR
   * assume "conversa de qualificação normal" e ignora que o lead está respondendo a um follow. */
  respondendoAutomacao?: boolean
  /** Texto literal da mensagem atual do lead (trava da abertura não pode depender só do que a IA classificou). */
  mensagemLead: string
}

export interface Decisao {
  acao: Acao
  estado: Estado
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** O número (em reais) que o LEAD disse na resposta, se ele disse algum ("uns 200", "consigo 300 por mês",
 * "tenho 2 mil"). Ignora número pequeno demais pra ser valor de investimento (evita "2 funcionários", "3x"
 * viram falso positivo). null quando não há número claro: "sim, tenho", "ainda não pensei" nunca cortam. */
export function valorDitoPeloLead(texto: string): number | null {
  const t = norm(texto)
  let melhor: number | null = null
  for (const m of t.matchAll(/(?:r\$\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)\s*(mil)?/g)) {
    let n = parseFloat(m[1].replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'))
    if (isNaN(n)) continue
    if (m[2]) n *= 1000
    const temSinal = /r\$/.test(m[0]) || m[2] || n >= 10
    if (!temSinal) continue
    if (melhor === null || n < melhor) melhor = n
  }
  return melhor
}

/** Preenche {nome}, {segmento}... com o que se sabe; o que não se sabe some (com a vírgula que o segue). */
export function preencher(texto: string, dados: Record<string, string>): string {
  const vals: Record<string, string> = {
    nome: firstName(dados.nome),
    segmento: dados.segmento ?? '',
    ramo: dados.segmento ?? '',
    cidade: dados.cidade ?? '',
    nome_empresa: dados.nome_empresa ?? '',
  }
  let out = texto.replace(/\{(\w+)\}(,?\s*)/g, (_m, k: string, sep: string) => {
    const v = vals[k]
    return v ? `${v}${sep}` : ''
  })
  out = out.trim()
  return out ? out[0].toUpperCase() + out.slice(1) : out
}

export const firstName = (n?: string) => (n ?? '').trim().split(/\s+/)[0] ?? ''

const filled = (dados: Record<string, string>, campo: string) => !!dados[campo]?.trim()

export function qualificacaoCompleta(estado: Estado, config: CompanyConfig): boolean {
  return config.qualificacao.perguntas.filter((q) => q.obrigatoria).every((q) => filled(estado.dados, q.campo))
}

/** Próxima pergunta permitida: uma por turno, nunca a respondida, nunca a do turno anterior sem resposta. */
export function proximaPergunta(estado: Estado, config: CompanyConfig, abertura: boolean, ignorarJanela = false): { id: string; texto: string; reformulada: boolean; reformulacaoFixa: boolean } | null {
  const ordenadas = [...config.qualificacao.perguntas].sort((a, b) => a.ordem - b.ordem)
  for (const q of ordenadas) {
    if (filled(estado.dados, q.campo)) continue
    if (!q.obrigatoria && !abertura) continue
    const feitas = estado.perguntas_feitas.filter((p) => p.id === q.id)
    const ultima = feitas[feitas.length - 1]
    if (ultima && !ultima.respondida) {
      if (!ignorarJanela && estado.turno - ultima.turno < 2) continue
      if (feitas.length >= 2) continue
    }
    const reformulando = feitas.length > 0
    const reformulacaoFixa = reformulando && !!q.reformulacao
    const textoBase = reformulacaoFixa ? q.reformulacao! : q.texto
    return { id: q.id, texto: preencher(textoBase, estado.dados), reformulada: reformulando, reformulacaoFixa }
  }
  return null
}

/** A pergunta obrigatória "da vez" (a primeira ainda não preenchida) já foi feita 2x sem resposta reconhecível:
 * proximaPergunta desiste dela pra sempre (ver acima), e sem isso a conversa nunca mais tenta, nunca escala,
 * e completa() nunca fica true (achado real, lead Marcelo, 27/09/2026: escopo perguntado 2x, nenhuma resposta
 * reconhecida, o motor foi pra "fale com o Bruno" sem nunca dar o preço nem avisar um humano). */
export function perguntaObrigatoriaEmperrada(estado: Estado, config: CompanyConfig): { id: string } | null {
  const proxima = [...config.qualificacao.perguntas]
    .filter((q) => q.obrigatoria)
    .sort((a, b) => a.ordem - b.ordem)
    .find((q) => !filled(estado.dados, q.campo))
  if (!proxima) return null
  const feitas = estado.perguntas_feitas.filter((p) => p.id === proxima.id)
  const ultima = feitas[feitas.length - 1]
  return feitas.length >= 2 && ultima && !ultima.respondida ? { id: proxima.id } : null
}

const ORDEM_ETAPA: Etapa[] = ['abertura', 'qualificando', 'oferta_horario', 'confirmando', 'agendado']
function etapaAvanca(atual: Etapa, alvo: Etapa): Etapa {
  if (atual === 'encerrado' || atual === 'escalado') return alvo
  return ORDEM_ETAPA.indexOf(alvo) > ORDEM_ETAPA.indexOf(atual) ? alvo : atual
}

const asArr = (v: string | string[]) => (Array.isArray(v) ? v : [v])


export function decidir(ex: Extracao, entrada: Estado, config: CompanyConfig, ctx: DecisorCtx): Decisao {
  const estado: Estado = JSON.parse(JSON.stringify(entrada))
  estado.turno += 1
  const turno = estado.turno

  // 0. merge dos dados (só o que o lead disse) e fechamento das perguntas respondidas
  for (const [k, v] of Object.entries(ex.dados ?? {})) if (typeof v === 'string' && v.trim()) estado.dados[k] = v.trim()
  // horario_escolhido é campo separado de "dados" no extrator (não fica dentro de ex.dados), e por isso não
  // entrava no merge acima. Bug real (lead Cícero, 27/09): quando o mesmo turno também casava com uma regra de
  // prioridade maior (ex.: pergunta_como_funciona), a regra 9 nunca rodava e a escolha de horário do lead se
  // perdia pra sempre, mesmo ele repetindo. Precisa ser incondicional, igual ex.dados, não só dentro da regra 9.
  if (ex.horario_escolhido) estado.dados.horario_escolhido = ex.horario_escolhido
  const campoDe = (id: string) => config.qualificacao.perguntas.find((q) => q.id === id)?.campo
  for (const p of estado.perguntas_feitas) if (!p.respondida && campoDe(p.id) && filled(estado.dados, campoDe(p.id)!)) p.respondida = true

  // Desiste de uma pergunta obrigatória travada depois de escalar por causa dela uma vez: sem isso, toda vez que
  // o resto da qualificação fica completo em volta desse buraco, a mesma trava dispara handoff de novo, pausando
  // a conversa repetidamente pro sempre a cada novo turno (achado real, lead Rodrigo/conv530, 30/09/2026: "aparece
  // no Google?" nunca respondida escalou 2x seguidas, uma a cada vez que o resto do funil terminava de novo).
  // Uma escalada por pergunta travada já avisa o humano; não precisa repetir pra sempre.
  const desistirDe = (id: string) => {
    const campo = campoDe(id)
    if (campo && !filled(estado.dados, campo)) estado.dados[campo] = '(sem resposta)'
  }

  // Travas de orçamento: rodam antes de qualquer outra regra, não faz sentido continuar qualificando quem já
  // deixou claro que não cabe no bolso. As duas só disparam no turno em que o campo é preenchido pela primeira
  // vez: nunca reabrem sozinhas depois, mesmo que o campo continue com o mesmo valor.
  const encerraPorOrcamento = (): Decisao | null => {
    for (const q of config.qualificacao.perguntas) {
      const respondeuAgora = typeof ex.dados?.[q.campo] === 'string' && ex.dados[q.campo].trim() && !(entrada.dados[q.campo] ?? '').trim()
      if (!respondeuAgora) continue
      // encerrar_se_nao: pergunta fechada (sim/não). Só "nao" isolado ou com detalhe depois de ":"/",":
      // "nao sei" começa com as mesmas letras mas é resposta ambígua, fica pendente.
      if (q.encerrar_se_nao) {
        const v = norm(estado.dados[q.campo])
        if (v === 'nao' || /^nao[:,]/.test(v)) return frase(q.encerrar_se_nao)
      }
      // valor_minimo_aceitavel: pergunta aberta, sem ancorar valor. Só corta quando o PRÓPRIO lead cita um
      // número na resposta e esse número é menor que o mínimo; "sim, tenho" ou "ainda não pensei" (sem
      // número) seguem o fluxo normal.
      if (q.valor_minimo_aceitavel) {
        const dito = valorDitoPeloLead(estado.dados[q.campo])
        if (dito !== null && dito < q.valor_minimo_aceitavel.valor) return frase(q.valor_minimo_aceitavel.frase_recusa)
      }
    }
    return null
    function frase(texto: string): Decisao {
      return {
        estado: { ...estado, etapa: 'encerrado' },
        acao: { tipo: 'encerrar', reacao_social: false, social: null, conteudo: { modo: 'literal', texto: preencher(texto, estado.dados) }, fatos: [], proxima_pergunta: null, tom_do_lead: ex.tom_do_lead, contexto: [], etapa_depois: 'encerrado' },
      }
    }
  }
  const decisaoOrcamento = encerraPorOrcamento()
  if (decisaoOrcamento) return decisaoOrcamento

  const I = new Set(ex.intencoes)
  // Depois de já ter explicado "como funciona" uma vez nesta conversa, uma nova pergunta_como_funciona vira
  // pergunta_fato de verdade (RAG): nunca repete o mesmo texto fixo de novo, e responde o que o lead pediu.
  if (I.has('pergunta_como_funciona') && (!config.como_funciona || estado.contadores.como_funciona_explicado)) I.add('pergunta_fato')
  const perguntaFato = ex.pergunta_fato ?? (I.has('pergunta_como_funciona') ? 'Como funciona o serviço da empresa?' : null)
  const reacaoSocial = I.has('social')
  if (reacaoSocial) estado.ultima_reacao_social_turno = turno

  const soOutro = ex.intencoes.length > 0 && ex.intencoes.every((i) => i === 'outro')
  estado.contadores.outros_seguidos = soOutro ? estado.contadores.outros_seguidos + 1 : 0
  estado.contadores.baixa_confianca_seguidas = ex.confianca === 'baixa' ? estado.contadores.baixa_confianca_seguidas + 1 : 0

  // Lead voltou depois de encerrar (e não é só agradecimento): recomeça sem herdar as recusas
  const soAgradecimento = ex.social?.tipo === 'agradecimento' && ex.intencoes.every((i) => i === 'social' || i === 'outro')
  if (estado.etapa === 'encerrado' && !I.has('recusa') && !soAgradecimento) {
    estado.etapa = 'qualificando'
    estado.recusas = 0
    // Volta com a página em branco pra preço e objeção: senão, o primeiro pedido de preço depois de
    // voltar já escala direto pro Bruno (contador antigo de antes de encerrar), sem nem responder de novo.
    estado.pedidos_de_preco = 0
    estado.objecoes_respondidas = []
  }

  const completa = qualificacaoCompleta(estado, config)
  const abertura = estado.etapa === 'abertura' && ctx.primeiraMensagemNossa

  // Trava da abertura (em código, não em classificação da IA): a mensagem que trouxe o lead até aqui é o gancho
  // do anúncio, e tem infinitas variações de texto. Na primeira mensagem da conversa, só libera falar preço ou
  // explicar o serviço quando o texto LITERAL do lead pede isso, palavra por palavra: nunca por causa do que a IA
  // achou que a intenção era. Depois da abertura, o classificador de intenção volta a valer normalmente.
  const PRECO_EXPLICITO_RE = /quanto (custa|fica|sai|e|eh|e o valor|eu pago|invisto)|qual (o |e o )?(valor|preco|orcamento|investimento)|tem desconto|valor (do|da|pra|para)|\bpreco\b|\binvestimento\b/
  const COMO_FUNCIONA_EXPLICITO_RE = /como funciona|como (e|eh) (o processo|feito)|qual (e|eh) o processo|como (voces? |voce )?faz(em)?|o que voces? faz(em)?|me explica/
  const pedeuPrecoDeVerdade = !abertura || PRECO_EXPLICITO_RE.test(norm(ctx.mensagemLead))
  const pedeuComoFuncionaDeVerdade = !abertura || COMO_FUNCIONA_EXPLICITO_RE.test(norm(ctx.mensagemLead))

  const base = (tipo: Acao['tipo'], extra: Partial<Acao> = {}): Acao => ({
    tipo,
    reacao_social: reacaoSocial,
    social: ex.social,
    conteudo: null,
    fatos: [],
    proxima_pergunta: null,
    tom_do_lead: ex.tom_do_lead,
    contexto: [],
    etapa_depois: etapaAvanca(estado.etapa, 'qualificando'),
    ...extra,
  })

  // Spec seção 4 ("qualificação enxuta"): a cada 2 perguntas respondidas, um comentário curto sobre a resposta
  // antes da próxima, pra não virar interrogatório. Só quando o lead acabou de responder uma pergunta nossa.
  const respondidas = estado.perguntas_feitas.filter((p) => p.respondida).length
  const comentar = (a: Acao) => {
    if (I.has('resposta_qualificacao') && respondidas > 0 && respondidas % 2 === 0) {
      a.contexto.push('Antes da pergunta, faça um comentário curto (meia frase) sobre o que o lead acabou de responder, como uma pessoa faria. Sem inventar fato, número, resultado nem dizer que viu ou analisou algo dele.')
    }
  }

  // Conteúdo fixo que já termina em pergunta (ex.: preço com CTA de agendamento embutido no texto da config,
  // "...topa marcar 15 minutos?"): nunca cola uma segunda pergunta em cima. Regra geral, vale pra qualquer
  // empresa que termine um bloco literal com "?", não só preço.
  const literalJaTerminaEmPergunta = (a: Acao) => a.conteudo?.modo === 'literal' && asArr(a.conteudo.texto).join(' ').trim().endsWith('?')

  const comPergunta = (a: Acao, permitir = true): Acao => {
    if (!permitir || completa || literalJaTerminaEmPergunta(a)) return a
    const q = proximaPergunta(estado, config, false)
    if (q) {
      a.proxima_pergunta = { id: q.id, texto: q.texto }
      comentar(a)
      if (q.reformulada && !q.reformulacaoFixa) a.contexto.push('Esta pergunta já foi feita antes e não foi respondida: reformule com outras palavras, sem cobrar.')
    } else if (!a.handoff) {
      const travada = perguntaObrigatoriaEmperrada(estado, config)
      if (travada) {
        a.handoff = { motivo: `pergunta obrigatória "${travada.id}" sem resposta reconhecível após 2 tentativas` }
        desistirDe(travada.id)
      }
    }
    return a
  }

  /** Só a parte de "pergunta obrigatória travada" do comPergunta acima, sem colar a próxima pergunta:
   * usado em respostas que não devem emendar o roteiro na mesma respirada (ex.: responder_fato), mas que
   * ainda precisam escalar se a qualificação estiver presa há 2 tentativas sem resposta reconhecível. */
  const handoffSeTravado = (a: Acao): Acao => {
    if (completa || a.handoff) return a
    const travada = perguntaObrigatoriaEmperrada(estado, config)
    if (travada) {
      a.handoff = { motivo: `pergunta obrigatória "${travada.id}" sem resposta reconhecível após 2 tentativas` }
      desistirDe(travada.id)
    }
    return a
  }

  const escalar = (motivo: string, duvida = false): Decisao => ({
    estado: { ...estado, etapa: 'escalado' },
    acao: base(duvida ? 'escalar_duvida' : 'escalar', {
      conteudo: { modo: 'literal', texto: duvida ? config.escala.frase_duvida : config.escala.frase },
      handoff: { motivo },
      etapa_depois: 'escalado',
    }),
  })

  const encerrar = (frase: string): Decisao => ({
    estado: { ...estado, etapa: 'encerrado' },
    acao: base('encerrar', { conteudo: { modo: 'literal', texto: frase }, etapa_depois: 'encerrado' }),
  })

  // Agradecimento depois de encerrar/agendar: uma resposta e pronto
  // Também quando o lead só agradece em resposta a uma automação nossa (follow, remarketing, promoção): achado real
  // (lead Mike/63473, 28/09) — respondeu "Tá okay obrigado" ao áudio final do follow ("vou parar de te procurar"),
  // o estado do v3 ainda estava em "qualificando" e o SDR voltou a perguntar nome/ramo/cidade da empresa.
  if (soAgradecimento && (estado.etapa === 'encerrado' || estado.etapa === 'agendado' || ctx.respondendoAutomacao) && config.agradecimento_fim?.frase) {
    return { estado, acao: base('agradecimento_fim', { conteudo: { modo: 'literal', texto: config.agradecimento_fim.frase }, etapa_depois: estado.etapa }) }
  }

  // 0. resposta automática da empresa do lead (menu, "em breve retornaremos", horário de atendimento): não responde.
  // Robô respondendo robô é o que mais denuncia bot e gera loop. A pessoa de verdade responde depois e aí segue.
  const temDado = Object.values(ex.dados ?? {}).some((v) => typeof v === 'string' && v.trim())
  const SUBSTANTIVAS: Intencao[] = ['pergunta_preco', 'quer_agendar', 'escolheu_horario', 'informou_email', 'pede_humano', 'pergunta_fato', 'pergunta_como_funciona', 'objecao', 'recusa', 'pede_ligacao', 'pede_pagamento', 'pergunta_se_e_robo', 'cancela_reuniao', 'pede_remarcar']
  if (ex.resposta_automatica && !temDado && !SUBSTANTIVAS.some((i) => I.has(i))) {
    estado.contadores.outros_seguidos = 0
    estado.contadores.baixa_confianca_seguidas = 0
    return { estado, acao: base('aguardar', { silencio: true, etapa_depois: estado.etapa }) }
  }

  // 1. pede humano / confiança baixa ou "outro" 2x seguidas
  if (I.has('pede_humano') || estado.contadores.baixa_confianca_seguidas >= 2 || estado.contadores.outros_seguidos >= 2) {
    return escalar(I.has('pede_humano') ? 'lead pediu para falar com uma pessoa' : 'mensagem não entendida duas vezes seguidas')
  }

  // 2. é robô?
  if (I.has('pergunta_se_e_robo')) {
    return {
      estado,
      acao: comPergunta(base('responder_identidade', { conteudo: { modo: config.identidade.modo ?? 'literal', texto: config.identidade.frase_robo } })),
    }
  }

  // 2b. cancelar reunião de verdade (evento real no Calendar): prioridade alta, ANTES de recusa/objeção
  // (achado real, lead Rodrigo Evangelista/63104, 28/09/2026: "quero cancelar" repetido foi classificado
  // também como "recusa", caiu na regra de objeção repetida e a conversa encerrou sem cancelar nada de
  // verdade — o evento ficou órfão no Calendar real do Bruno). Se o lead já deu um horário novo na mesma
  // mensagem, não é cancelamento puro, é remarcação: a regra 9 cuida disso (cancela o antigo, cria o novo).
  if (ctx.temCalendario && ctx.temReuniaoAtiva && I.has('cancela_reuniao') && !ex.horario_escolhido) {
    estado.etapa = 'qualificando'
    return { estado, acao: base('cancelar_reuniao', { etapa_depois: 'qualificando' }) }
  }

  // 2c. recusa em resposta a uma automação nossa (follow-up, remarketing, promoção, lembrete): encerra na hora,
  // com educação e sem insistir (etapa "encerrado" já move o lead pra Perdido no CRM). Sem isso o SDR entrava em
  // "objeção repetida"/pergunta de qualificação como se fosse o início de uma conversa, sem saber o que o follow
  // tinha dito. Só quando é recusa pura: se o lead também pergunta algo ou quer agendar, segue o fluxo normal.
  if (ctx.respondendoAutomacao && I.has('recusa') && !I.has('pergunta_preco') && !I.has('pergunta_fato') && !I.has('pergunta_como_funciona') && !I.has('quer_agendar') && !I.has('escolheu_horario')) {
    return encerrar(config.encerramento_recusas?.frase ?? config.escala.frase)
  }

  // 2d. atalho de agendamento: horário e/ou e-mail informados. Prioridade alta, ANTES de como_funciona/preço/fato
  // (achado real, lead Simone/conv923, 30/09/2026: ela escolheu "hoje às 17h" e perguntou "como funciona" na
  // mesma mensagem; a regra de como_funciona rodava primeiro, respondia a explicação de novo e colava por cima
  // uma pergunta de qualificação sem relação nenhuma com o que ela pediu, ignorando o horário que ela tinha
  // acabado de escolher. Confirmar/pedir o que falta pro agendamento vale mais que responder uma pergunta a
  // mais: quem já escolheu horário está a um passo de marcar, não é hora de reabrir explicação.
  // Vale também com reunião já marcada: é uma remarcação. O turno cancela o evento antigo antes de criar o novo,
  // nunca cria os dois sem cancelar; ver eventoParaCancelar em agenda.ts.
  if (ctx.temCalendario && (I.has('escolheu_horario') || I.has('informou_email'))) {
    const nomeCompleto = estado.dados.nome_completo || (estado.dados.nome?.trim().split(/\s+/).length >= 2 ? estado.dados.nome : '')
    const horario = estado.dados.horario_escolhido
    const email = estado.dados.email
    if (horario && email && nomeCompleto) {
      estado.etapa = 'confirmando'
      return { estado, acao: base('agendar', { etapa_depois: 'agendado' }) }
    }
    if (horario || I.has('informou_email')) {
      estado.etapa = 'confirmando'
      const falta = [!nomeCompleto ? 'nome completo' : '', !email ? 'e-mail' : ''].filter(Boolean)
      if (falta.length > 0) {
        return {
          estado,
          acao: base('pedir_dados_agendamento', {
            conteudo: { modo: 'livre', texto: `Pra enviar o convite, preciso do seu ${falta.join(' e ')}.` },
            etapa_depois: 'confirmando',
          }),
        }
      }
    }
  }

  // 3. fora do escopo
  if (I.has('fora_do_escopo')) {
    return { estado, acao: comPergunta(base('responder_fora_escopo', { conteudo: { modo: 'literal', texto: config.fora_escopo.frase } })) }
  }

  // 3a. interesse em outra frente (tráfego pago, social media, produção audiovisual): o funil inteiro (dor_central,
  // perfil_google, escopo) foi desenhado só pra Fundação Digital (GMN/site) e nunca oferecia essas 3 frentes pro
  // lead, mesmo quando ele pedia direto (achado real, Rodrigo testando, 30/09/2026: "Estou precisando de leads"
  // foi ignorado e o funil seguiu perguntando sobre Google Meu Negócio). Quando reconhecido, marca escopo como
  // 'outra_frente' (sem preço fixo, sempre conversa com o Bruno) e os campos específicos de GMN como n/a, pra não
  // travar a qualificação nem seguir perguntando coisa sem relação com o que o lead pediu. Só dispara uma vez
  // (guard no valor de escopo): das próximas vezes só deixa o funil seguir adiante normalmente.
  // IMPORTANTE: usa base() puro, NUNCA comPergunta/handoffSeTravado aqui. Achado real, Rodrigo/conv530,
  // 30/09/2026: a pergunta de orçamento (outro campo, sem relação com essa trava) já tinha ficado presa 2x
  // ANTES do lead pivotar pra essa frente; se colar a checagem de trava no mesmo turno que reconhece o pivô, o
  // lead é escalado pro Bruno no exato turno em que finalmente foi entendido — parece bug, mesmo sendo dois
  // problemas diferentes colidindo. Dá um turno de respiro: a trava (se ainda existir) só é reavaliada no
  // próximo turno, pelo fluxo normal.
  if (I.has('interesse_outra_frente') && (estado.dados.escopo ?? '').trim() !== 'outra_frente') {
    estado.dados.escopo = 'outra_frente'
    if (!filled(estado.dados, 'aparece_no_google')) estado.dados.aparece_no_google = 'n/a'
    if (!filled(estado.dados, 'tem_perfil_google')) estado.dados.tem_perfil_google = 'n/a'
    const fatoOutrasFrentes = config.fatos?.find((f) => f.id === 'outras_frentes')
    if (fatoOutrasFrentes) {
      return { estado, acao: base('responder_fato', { fatos: [{ id: fatoOutrasFrentes.id, texto: fatoOutrasFrentes.texto }] }) }
    }
  }

  // 3b. preço por escopo e "como funciona": o valor e a explicação saem como texto fixo da config, nunca escritos pela IA
  const pe = config.preco.pode_informar ? config.preco.por_escopo : undefined
  const escopo = pe ? (estado.dados[pe.campo] ?? '').trim() : ''
  const ehOutraFrente = escopo === 'outra_frente'
  const opcao = pe && !ehOutraFrente ? pe.opcoes.find((o) => o.valor === escopo) : undefined
  const escopoMudouAgora = !!pe && !!ex.dados?.[pe.campo]?.trim() && ex.dados[pe.campo].trim() !== (entrada.dados[pe.campo] ?? '').trim()
  const blocosDe = (t: string | string[]) => asArr(preencher2(t, estado.dados))

  if (I.has('pergunta_como_funciona') && config.como_funciona && pedeuComoFuncionaDeVerdade && !estado.contadores.como_funciona_explicado) {
    let blocos = blocosDe(config.como_funciona.texto)
    if (pe && opcao && I.has('pergunta_preco')) blocos = [...blocos, ...blocosDe(opcao.texto)]
    else if (pe && !opcao && !ehOutraFrente) {
      blocos = [...blocos, preencher(pe.pergunta, estado.dados)]
      estado.contadores.escopo_perguntado = true
    }
    estado.contadores.como_funciona_explicado = true
    const a = base('responder_como_funciona', { conteudo: { modo: 'literal', texto: blocos } })
    return { estado, acao: pe && !opcao && !ehOutraFrente ? a : comPergunta(a) }
  }

  // 4. preço
  if ((I.has('pergunta_preco') && pedeuPrecoDeVerdade) || (pe && escopoMudouAgora && estado.contadores.escopo_perguntado)) {
    if (ehOutraFrente) {
      return {
        estado,
        acao: comPergunta(base('responder_preco', { conteudo: { modo: 'literal', texto: 'Pra essa frente, o valor certinho o Bruno define junto com você, olhando o seu caso.' } })),
      }
    }
    if (pe && opcao) {
      estado.pedidos_de_preco += 1
      // Mesmo escopo, valor já enviado: não despeja o texto inteiro de novo (achado real, conv 530, 28/09: preço
      // idêntico 2x seguidas). Relembra curto, com os mesmos números (o validador confere que não mudou nada).
      if (estado.contadores.preco_enviado === opcao.valor) {
        const a = base('responder_preco', { conteudo: { modo: 'livre', texto: asArr(blocosDe(opcao.texto))[0] } })
        a.contexto.push('Você já passou esse valor nesta conversa. Relembre em uma frase curta, começando com algo como "Como te passei", sem repetir o texto todo e sem mudar nenhum número.')
        return { estado, acao: comPergunta(a) }
      }
      estado.contadores.preco_enviado = opcao.valor
      return { estado, acao: comPergunta(base('responder_preco', { conteudo: { modo: 'literal', texto: blocosDe(opcao.texto) } })) }
    }
    estado.pedidos_de_preco += 1
    if (estado.pedidos_de_preco >= config.preco.escalar_apos) return escalar('lead insistiu em saber o valor')
    if (pe) {
      estado.contadores.escopo_perguntado = true
      return { estado, acao: base('responder_preco', { conteudo: { modo: 'literal', texto: preencher(pe.pergunta, estado.dados) } }) }
    }
    const antes = config.preco.frases_antes_qualificacao
    const frase = completa ? config.preco.frase_depois_qualificacao : antes[(estado.pedidos_de_preco - 1) % antes.length]
    return { estado, acao: comPergunta(base('responder_preco', { conteudo: { modo: 'literal', texto: frase } })) }
  }

  // 5. objeção
  // Dispara por I.has('objecao') OU por objecao_id sozinho: achado real (lead Roberto/conv941, 30/09/2026) —
  // a IA reconheceu certinho a objeção ("tem uma agência que cuida das otimizações" = ja_uso_outra_coisa,
  // objecao_id preenchido), mas esqueceu de marcar "objecao" na lista de intenções. Sem esse OR, a regra
  // inteira nunca rodava, a resposta configurada pra essa objeção nunca saía, e o SDR seguia pra próxima
  // pergunta do roteiro como se o lead não tivesse dito nada relevante. objecao_id preenchido já é prova
  // suficiente: o extrator só deixa passar quando bate com um id real da lista configurada.
  if (I.has('objecao') || ex.objecao_id) {
    // Classificou como objeção mas não bateu com nenhum id configurado (extractor.ts só deixa objecao_id
    // passar quando está na lista): sem isso, a regra inteira era pulada em silêncio e a objeção real do
    // lead nunca recebia resposta nenhuma. Escala em vez de ignorar.
    if (!ex.objecao_id) return escalar('objeção não reconhecida na lista configurada', true)
    const obj: ObjecaoConfig | undefined = config.objecoes.find((o) => o.id === ex.objecao_id)
    if (obj) {
      if (obj.conta_como_recusa) estado.recusas += 1
      if (estado.recusas >= config.limites.recusas_para_encerrar && obj.conta_como_recusa) {
        return encerrar(config.encerramento_recusas?.frase ?? config.escala.frase)
      }
      if (estado.objecoes_respondidas.includes(obj.id)) {
        const frase = config.objecao_repetida?.frase
        return frase
          ? { estado, acao: base('objecao_repetida', { conteudo: { modo: 'literal', texto: frase } }) }
          : escalar('objeção repetida')
      }
      estado.objecoes_respondidas.push(obj.id)
      const semDado = obj.resposta_sem_dado && !filled(estado.dados, obj.resposta_sem_dado.campo)
      const texto = preencher2(semDado ? obj.resposta_sem_dado!.resposta : obj.resposta, estado.dados)
      const a = base('responder_objecao', { conteudo: { modo: obj.modo, texto } })
      if (obj.proxima_acao === 'encerrar') {
        estado.etapa = 'encerrado'
        a.etapa_depois = 'encerrado'
        return { estado, acao: a }
      }
      if (obj.proxima_acao === 'escalar') {
        a.handoff = { motivo: `objeção: ${obj.titulo}` }
        a.etapa_depois = 'escalado'
        estado.etapa = 'escalado'
        return { estado, acao: a }
      }
      return { estado, acao: comPergunta(a, obj.proxima_acao === 'voltar_qualificacao') }
    }
  }

  // 6. recusa
  if (I.has('recusa')) {
    estado.recusas += 1
    if (estado.recusas >= config.limites.recusas_para_encerrar) return encerrar(config.encerramento_recusas?.frase ?? config.escala.frase)
    const frase = config.objecao_repetida?.frase
    return frase
      ? { estado, acao: base('objecao_repetida', { conteudo: { modo: 'literal', texto: frase } }) }
      : { estado, acao: base('aguardar') }
  }

  // 7. pede ligação (quem já tem reunião marcada não recebe oferta de outro canal: cai na regra 10, que confirma a reunião)
  if (I.has('pede_ligacao') && config.ligacao && !ctx.reuniaoExistente) {
    if (estado.contadores.ligacao_oferecida) {
      estado.etapa = 'escalado'
      return {
        estado,
        acao: base('oferecer_ligacao', {
          conteudo: { modo: 'literal', texto: config.ligacao.confirmacao },
          handoff: { motivo: 'lead aceitou receber ligação' },
          etapa_depois: 'escalado',
        }),
      }
    }
    estado.contadores.ligacao_oferecida = true
    return { estado, acao: base('oferecer_ligacao', { conteudo: { modo: 'literal', texto: config.ligacao.oferta } }) }
  }

  // 8. pergunta sobre fato (o RAG é consultado pelo turno; sem resultado e sem fatos na config vira escalar_duvida)
  // NÃO cola a próxima pergunta de qualificação em cima da resposta (achado real, 01/10/2026: lead perguntou
  // "quais serviços tem?", recebeu a resposta certa e, na mesma respirada, já veio "você vive só de indicação
  // e boca a boca?" colado — parece bot justamente por responder e emendar o roteiro sem pausa nenhuma). O
  // lead perguntou algo fora do roteiro por conta própria: merece só a resposta. A qualificação segue normal
  // na mensagem seguinte dele, sem perder nada, só sem forçar a virada na mesma respirada.
  if (I.has('pergunta_fato') && perguntaFato) {
    const a = base('responder_fato', {
      consulta_rag: perguntaFato,
      fatos: (config.fatos ?? []).map((f) => ({ id: f.id, texto: f.texto })),
    })
    return { estado, acao: handoffSeTravado(a) }
  }

  // 10. já existe reunião marcada: nunca reabre qualificação a partir daqui, mesmo que falte campo obrigatório
  // (ex.: lead confirmando presença no lembrete de anti no-show com "Sim" não pode receber "qual o nome da empresa?" de novo).
  if (ctx.temCalendario && ctx.reuniaoExistente) {
    // Pergunta sobre ligação: é fato da empresa (ex.: Grupo Venda, o Bruno liga no WhatsApp), nunca oferece
    // canal genérico pra quem já tem reunião marcada.
    if (I.has('pede_ligacao') && config.ligacao?.reuniao_e_ligacao) {
      return {
        estado,
        acao: base('responder_fato', { fatos: [{ id: 'reuniao_ligacao', texto: config.ligacao.reuniao_e_ligacao }], etapa_depois: 'agendado' }),
      }
    }
    // Pediu remarcar/cancelar mas ainda não disse pra quando: oferece horários novos (a regra 9 trata quando ele escolher).
    if (I.has('pede_remarcar')) {
      estado.contadores.horarios_ofertados = true
      return { estado, acao: base('oferecer_horarios', { etapa_depois: 'oferta_horario' }) }
    }
    return {
      estado,
      acao: base('responder_fato', {
        fatos: [{ id: 'reuniao_existente', texto: `A reunião já está agendada para ${ctx.reuniaoExistente}. O convite com o link foi enviado por e-mail.` }],
        etapa_depois: 'agendado',
      }),
    }
  }
  // Lead pediu um minuto e não escolheu nada: espera, sem reoferecer horário por cima (achado real: loop de oferta
  // repetida porque `completa` vinha antes de `pede_espera`).
  if (I.has('pede_espera') && !I.has('quer_agendar') && !I.has('escolheu_horario') && !I.has('informou_email') && !ex.horario_escolhido) {
    return { estado, acao: base('aguardar') }
  }
  if (I.has('quer_agendar') || completa) {
    if (!completa) {
      const a = base('perguntar')
      a.contexto.push('O lead quer agendar. Diga em meia frase que já vai ver o horário e faça a pergunta.')
      return { estado, acao: comPergunta(a) }
    }
    if (!ctx.temCalendario) return escalar('qualificação completa e a empresa não tem calendário')
    // Já tem um horário pendente de confirmação (o lead escolheu antes, só faltou nome/e-mail, ou o turno em que
    // ele escolheu foi resolvido por outra regra de prioridade maior nesse meio-tempo): nunca reoferece do zero
    // igual disco riscado, resolve o que falta primeiro (mesmo bug real do lead Cícero, 27/09).
    if (estado.dados.horario_escolhido) {
      const nomeCompleto = estado.dados.nome_completo || (estado.dados.nome?.trim().split(/\s+/).length >= 2 ? estado.dados.nome : '')
      const email = estado.dados.email
      estado.etapa = 'confirmando'
      if (email && nomeCompleto) return { estado, acao: base('agendar', { etapa_depois: 'agendado' }) }
      const falta = [!nomeCompleto ? 'nome completo' : '', !email ? 'e-mail' : ''].filter(Boolean)
      return {
        estado,
        acao: base('pedir_dados_agendamento', {
          conteudo: { modo: 'livre', texto: `Pra fechar o agendamento, só preciso do seu ${falta.join(' e ')}.` },
          etapa_depois: 'confirmando',
        }),
      }
    }
    // Horários já mandados e o lead não trouxe nada novo (nem pediu outro período, nem pediu pra agendar):
    // não despeja a mesma lista de novo, só pergunta se algum serve. Passou do limite de ofertas: vai pra pessoa.
    const disponibilidadeNova = !!ex.dados?.disponibilidade?.trim() && ex.dados.disponibilidade.trim() !== (entrada.dados.disponibilidade ?? '').trim()
    if (estado.contadores.horarios_ofertados && estado.etapa === 'oferta_horario' && !disponibilidadeNova && !I.has('quer_agendar')) {
      if (estado.perguntas_feitas.filter((p) => p.id === 'horario').length >= 2) return escalar('lead recebeu horários, foi lembrado 2 vezes e não escolheu nenhum')
      const a = base('perguntar', { etapa_depois: 'oferta_horario' })
      a.proxima_pergunta = { id: 'horario', texto: 'Algum desses horários fica bom pra você, ou prefere outro dia ou período?' }
      a.contexto.push('Os horários já foram enviados na mensagem anterior. Não repita a lista.')
      return { estado, acao: a }
    }
    if ((estado.contadores.ofertas_horario ?? 0) >= LIMITE_OFERTAS_HORARIO) return escalar(`lead recebeu horários ${LIMITE_OFERTAS_HORARIO} vezes e não escolheu nenhum`)
    estado.contadores.horarios_ofertados = true
    return { estado, acao: base('oferecer_horarios', { etapa_depois: 'oferta_horario' }) }
  }

  // 11. pede espera
  if (I.has('pede_espera')) return { estado, acao: base('aguardar') }

  // 12. pagamento
  if (I.has('pede_pagamento')) {
    if (!ctx.cobrancaAtiva) return escalar('lead pediu para pagar e a cobrança automática não está ativa')
    // Preço por escopo: nunca gera cobrança do valor fixo da config sem saber qual escopo (Start e Essencial têm valores diferentes)
    if (pe && !opcao) {
      estado.contadores.escopo_perguntado = true
      return { estado, acao: base('perguntar', { conteudo: { modo: 'literal', texto: preencher(pe.pergunta, estado.dados) } }) }
    }
    if (!filled(estado.dados, 'cpf_cnpj')) {
      return {
        estado,
        acao: base('perguntar', { proxima_pergunta: { id: 'cpf_cnpj', texto: 'Pra gerar o pagamento, preciso do seu CPF ou CNPJ. Pode me passar?' } }),
      }
    }
    return { estado, acao: base('gerar_cobranca') }
  }

  // 13. demais: próxima pergunta (na abertura pode ser qualquer uma, inclusive opcional)
  const soSocial = I.has('social') && ex.intencoes.every((i) => i === 'social' || i === 'outro')
  const q = proximaPergunta(estado, config, abertura, soSocial)
  const a = base('perguntar')
  if (q) {
    a.proxima_pergunta = { id: q.id, texto: q.texto }
    if (!abertura) comentar(a)
    if (q.reformulada && !q.reformulacaoFixa) a.contexto.push('Esta pergunta já foi feita antes e não foi respondida: reformule com outras palavras, sem cobrar.')
  } else if (!abertura) {
    const travada = perguntaObrigatoriaEmperrada(estado, config)
    if (travada) {
      a.handoff = { motivo: `pergunta obrigatória "${travada.id}" sem resposta reconhecível após 2 tentativas` }
      desistirDe(travada.id)
    }
  }
  if (abertura) {
    a.contexto.push(`Primeira mensagem da conversa: apresente-se pelo nome (${config.persona.nome_agente}) e pela empresa (${config.persona.empresa}).`)
    if (ctx.contextoOutbound) a.contexto.push(`O lead recebeu um disparo nosso antes: "${ctx.contextoOutbound}". Não se reapresente como se fosse o primeiro contato.`)
    if (ctx.origemAnuncio) a.contexto.push(`O lead chegou pelo anúncio: "${ctx.origemAnuncio}".`)
    if (!filled(estado.dados, 'nome')) {
      a.contexto.push('Pergunte o nome de forma direta ("Qual o seu nome?"). Nunca adivinhe nem confirme um nome a partir do perfil do WhatsApp, nem escreva "Falo com fulano?".')
    }
  } else if (!q) {
    a.tipo = 'aguardar'
  }
  return { estado, acao: a }
}

function preencher2(t: string | string[], dados: Record<string, string>): string | string[] {
  return Array.isArray(t) ? t.map((x) => preencher(x, dados)) : preencher(t, dados)
}

export { asArr, norm }
