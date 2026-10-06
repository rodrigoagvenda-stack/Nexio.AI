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
  /** Reunião marcada cujo horário já passou e ainda sem resultado registrado (call_status segue 'agendada'). */
  reuniaoJaAconteceu?: boolean
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

  // 0b. implicação lógica entre campos: acabou de preencher um campo que, por si só, já responde outro campo
  // ainda vazio (ex.: fez_anuncio="sim" já implica so_indicacao="nao"). Nunca sobrescreve resposta real do lead.
  for (const imp of config.qualificacao.implicacoes ?? []) {
    const valorSe = estado.dados[imp.se_campo]
    if (valorSe?.trim().toLowerCase().startsWith(imp.se_comeca_com.toLowerCase()) && !filled(estado.dados, imp.entao_campo)) {
      estado.dados[imp.entao_campo] = imp.entao_valor
    }
  }

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
  // Junta todas as dúvidas distintas num só texto pro RAG: o extrator agora guarda uma por item (array), não só a
  // primeira -- nunca perde pergunta com fato pronto só porque veio colada com outra sem fato na mesma mensagem.
  const perguntaFato = ex.pergunta_fato.length > 0 ? ex.pergunta_fato.join('\n') : (I.has('pergunta_como_funciona') ? 'Como funciona o serviço da empresa?' : null)
  const reacaoSocial = I.has('social')
  if (reacaoSocial) estado.ultima_reacao_social_turno = turno

  // "Outro" que trouxe dado (ex.: respondeu fez_anuncio, impacto) é resposta, não "não entendi": não conta pra escalar.
  // Achado real, lead Guilherme/63558, 05/10/2026: duas respostas com dado caíram em "outro" e a 3ª escalou pro Bruno.
  const algumDado = Object.values(ex.dados ?? {}).some((v) => typeof v === 'string' && v.trim())
  const soOutro = ex.intencoes.length > 0 && ex.intencoes.every((i) => i === 'outro') && !algumDado
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

  // Originalmente (Spec seção 4, "qualificação enxuta"): comentário só a cada 2 perguntas respondidas, numa
  // contagem cega, pra não virar interrogatório. Achado real, lead Willian/conv944, 30/09/2026: ele disse "Tenho
  // Google ads" e a contagem caiu exatamente num turno sem comentário — a próxima pergunta foi "você vive só de
  // indicação e boca a boca?", contradizendo o que ele tinha acabado de dizer. Uma contagem cega não sabe
  // QUANDO vale a pena comentar; troca pra sempre oferecer a chance, deixando o redator (que vê a mensagem real
  // do lead) decidir se tem algo que mereça meia frase de reconhecimento ou se é só um "sim"/"não" seco.
  const comentar = (a: Acao) => {
    if (I.has('resposta_qualificacao')) {
      a.contexto.push(
        'Antes da pergunta, veja a última mensagem do lead: se ela trouxe alguma informação real (não só "sim"/"não" seco), faça um comentário curto (meia frase) reconhecendo isso, como uma pessoa faria — nunca emende a próxima pergunta do roteiro como se ele não tivesse dito nada, principalmente se o que ele disse já responde ou contradiz parte da próxima pergunta. Se a resposta foi só um "sim"/"não" sem nada a mais, pode ir direto pra pergunta, sem comentário. Sem inventar fato, número, resultado nem dizer que viu ou analisou algo dele.',
      )
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

  /** Só a parte de "colar a próxima pergunta" do comPergunta acima, SEM nunca checar trava/handoff: usado
   * quando o turno já reconheceu algo importante (ex.: pivô pra outra frente) e precisa seguir qualificando,
   * mas não pode escalar na mesma respirada por causa de uma trava antiga e sem relação (achado real, lead
   * Edvaldo, 01/10/2026: a regra 3a usava base() puro pra evitar escalar junto com o pivô, só que isso também
   * cortou a pergunta seguinte — a conversa respondia certo e simplesmente parava, sem next step nenhum). */
  const comPerguntaSemTrava = (a: Acao): Acao => {
    if (completa || literalJaTerminaEmPergunta(a)) return a
    const q = proximaPergunta(estado, config, false)
    if (q) {
      a.proxima_pergunta = { id: q.id, texto: q.texto }
      comentar(a)
      if (q.reformulada && !q.reformulacaoFixa) a.contexto.push('Esta pergunta já foi feita antes e não foi respondida: reformule com outras palavras, sem cobrar.')
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
    // Achado real, lead Jorge Luiz/conv541, 03/10/2026: ele agradeceu duas vezes seguidas ("Obrigado", depois
    // "Beleza 🤝") e o SDR respondeu a MESMA frase fixa de despedida as duas vezes -- "uma resposta e pronto" só
    // valia na teoria, sem trava nenhuma. Segunda vez em diante fica em silêncio: a conversa já acabou.
    if (estado.contadores.agradecimento_fim_enviado) {
      return { estado, acao: base('aguardar', { silencio: true, etapa_depois: estado.etapa }) }
    }
    estado.contadores.agradecimento_fim_enviado = true
    return { estado, acao: base('agradecimento_fim', { conteudo: { modo: 'literal', texto: config.agradecimento_fim.frase }, etapa_depois: estado.etapa }) }
  }

  // Reunião já aconteceu e o resultado não foi registrado: nunca reabre qualificação nem oferece horário por cima.
  // Achado real, lead Edevane/conv535, 05/10/2026: call às 09:30, depois o SDR voltou a perguntar sobre o Google
  // como se fosse a primeira vez, porque só reconhecia reunião com horário no futuro. Passa pra pessoa.
  if (ctx.reuniaoJaAconteceu && !I.has('quer_agendar') && !I.has('escolheu_horario') && !I.has('pede_remarcar') && !I.has('cancela_reuniao')) {
    return escalar('reunião já aconteceu e o resultado ainda não foi registrado')
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

  // 1. pede humano / confiança baixa 2x seguidas / "não entendi" 3x seguidas (antes era 2x: escalava antes de
  // tentar reformular a pergunta, ver bloco "Não entendeu" mais abaixo)
  if (I.has('pede_humano') || estado.contadores.baixa_confianca_seguidas >= 2 || estado.contadores.outros_seguidos >= 3) {
    return escalar(I.has('pede_humano') ? 'lead pediu para falar com uma pessoa' : 'mensagem não entendida duas vezes seguidas')
  }

  // 1b. recusa de ligação na hora de agendar. Achado real, lead Henrique/5511949638123, 06/10/2026: depois de
  // receber horários de call ele disse "ligação não dá, precisa ser por aqui mesmo" e o SDR ofereceu horários de
  // novo, ignorando o pedido. Passa pra pessoa conversar por mensagem. Restrito à etapa de agendamento, e não vale
  // se ele já escolheu horário ou fala de videochamada/Meet; "só por aqui" solto (ex.: pedido de valor) não entra.
  const RECUSA_LIGACAO_RE = /\b(ligacao nao (da|rola|posso|consigo)|nao (posso|consigo) (ligar|atender|falar (por|no) telefone)|nao da pra (ligar|atender|falar (por|no) telefone)|nao (quero|gosto de) (ligacao|ligar|telefone)|precisa ser (por aqui|por mensagem|por escrito)|so (por|no) (aqui|mensagem|whatsapp|texto))\b/
  const msgNorm = norm(ctx.mensagemLead ?? '')
  if ((estado.contadores.horarios_ofertados || estado.etapa === 'oferta_horario') && !I.has('escolheu_horario') && !/\b(video|meet|chamada)\b/.test(msgNorm) && RECUSA_LIGACAO_RE.test(msgNorm)) {
    return escalar('lead não quer ligação, só conversa por mensagem')
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
            conteudo: { modo: 'livre', texto: `Show, fechamos esse horário! Pra enviar o convite, preciso do seu ${falta.join(' e ')}.` },
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
  // Achado real #2, lead Elydiane, 01/10/2026: essa regra citava SÓ o fato 'outras_frentes' (hardcoded), travado
  // num id fixo. Quando criei o fato 'oferta_bonus_ads' (pra um anúncio específico de promoção) ele nunca era
  // considerado aqui, mesmo sendo exatamente o caso: lead veio pelo anúncio do bônus, o fato genérico não
  // mencionava o bônus, o redator tentou falar o valor sozinho e travou (V4), e a resposta saiu vazia, sem
  // escalar de verdade. Agora passa TODOS os fatos como candidatos (igual a regra genérica de pergunta_fato,
  // linha ~540), com consulta_rag = mensagem do lead: quem escolhe qual fato citar é quem lê o texto de
  // verdade, não uma lista fixa de 1 item só.
  // Achado real, lead Douglas/5517996427654, 05/10/2026: mencionar anúncio apagava o escopo GMN/site já escolhido,
  // e todo valor (inclusive o do Google, que tem preço fixo) ia pro Bruno. Escolha real de GMN/site não é sobrescrita.
  const escopoRealConhecido = (config.preco.por_escopo?.opcoes ?? []).some((o) => o.valor === (estado.dados.escopo ?? '').trim())
  const anuncioSemEscopo = I.has('interesse_outra_frente') && !escopoRealConhecido
  // Pedido de valor de verdade não entra aqui: quem trata valor é a regra de preço logo abaixo.
  if (I.has('interesse_outra_frente') && (estado.dados.escopo ?? '').trim() !== 'outra_frente' && !escopoRealConhecido && !(I.has('pergunta_preco') && pedeuPrecoDeVerdade)) {
    estado.dados.escopo = 'outra_frente'
    if (!filled(estado.dados, 'aparece_no_google')) estado.dados.aparece_no_google = 'n/a'
    if (!filled(estado.dados, 'tem_perfil_google')) estado.dados.tem_perfil_google = 'n/a'
    if ((config.fatos ?? []).length > 0) {
      return {
        estado,
        acao: comPerguntaSemTrava(
          base('responder_fato', {
            consulta_rag: ctx.mensagemLead || perguntaFato || 'Em que frente (tráfego, social, audiovisual) o lead demonstrou interesse?',
            fatos: (config.fatos ?? []).map((f) => ({ id: f.id, texto: f.texto })),
          }),
        ),
      }
    }
  }

  // 3b. preço por escopo e "como funciona": o valor e a explicação saem como texto fixo da config, nunca escritos pela IA
  const pe = config.preco.pode_informar ? config.preco.por_escopo : undefined
  const escopo = pe ? (estado.dados[pe.campo] ?? '').trim() : ''
  const ehOutraFrente = escopo === 'outra_frente'
  const opcao = pe && !ehOutraFrente ? pe.opcoes.find((o) => o.valor === escopo) : undefined
  const escopoMudouAgora = !!pe && !!ex.dados?.[pe.campo]?.trim() && ex.dados[pe.campo].trim() !== (entrada.dados[pe.campo] ?? '').trim()
  const blocosDe = (t: string | string[]) => asArr(preencher2(t, estado.dados))
  // A pergunta de escopo (pe.pergunta) é feita por 3 caminhos diferentes aqui embaixo (como_funciona, pergunta de
  // preço, pede_pagamento), todos fora do fluxo normal de proxima_pergunta/perguntas_feitas que o resto da
  // qualificação usa. Achado real, lead Jorge Luiz/conv541, 03/10/2026: a regra 13 (próxima pergunta genérica)
  // não sabia que o escopo já tinha sido perguntado por um desses 3 caminhos (perguntas_feitas nunca recebia
  // entrada pra ela) e perguntava de novo, com outras palavras, poucos turnos depois -- duas perguntas quase
  // iguais seguidas. Registrar em perguntas_feitas aqui faz a janela de 2 turnos que toda pergunta já respeita
  // valer pro escopo também, não só pras perguntas feitas pelo caminho normal.
  const perguntaEscopo = pe ? config.qualificacao.perguntas.find((q) => q.campo === pe.campo) : undefined
  const marcarEscopoPerguntado = () => {
    estado.contadores.escopo_perguntado = true
    if (perguntaEscopo) estado.perguntas_feitas.push({ id: perguntaEscopo.id, turno: estado.turno, respondida: false })
  }

  if (I.has('pergunta_como_funciona') && config.como_funciona && pedeuComoFuncionaDeVerdade && !estado.contadores.como_funciona_explicado) {
    let blocos = blocosDe(config.como_funciona.texto)
    if (pe && opcao && I.has('pergunta_preco')) blocos = [...blocos, ...blocosDe(opcao.texto)]
    else if (pe && !opcao && !ehOutraFrente) {
      blocos = [...blocos, ...blocosDe(pe.pergunta)]
      marcarEscopoPerguntado()
    }
    estado.contadores.como_funciona_explicado = true
    const a = base('responder_como_funciona', { conteudo: { modo: 'literal', texto: blocos } })
    return { estado, acao: pe && !opcao && !ehOutraFrente ? a : comPergunta(a) }
  }

  // 4. preço
  // Achado real, lead Rose/63551, 05/10/2026: responder a pergunta de escopo disparava o preço sem o lead ter
  // pedido valor nenhum. Escopo respondido só vira preço se o lead já tinha pedido preço antes (pedidos_de_preco > 0).
  if ((I.has('pergunta_preco') && pedeuPrecoDeVerdade) || (pe && escopoMudouAgora && estado.contadores.escopo_perguntado && estado.pedidos_de_preco > 0)) {
    // Achado real, lead Douglas/5517996427654, 05/10/2026: pediu valor falando de anúncio e de Google. Antes de
    // mandar tudo pro Bruno, pergunta o escopo do GMN/site (que tem preço fixo). Anúncio: valor personalizado na call.
    if ((ehOutraFrente || anuncioSemEscopo) && pe && !estado.contadores.escopo_perguntado) {
      marcarEscopoPerguntado()
      estado.pedidos_de_preco += 1
      return { estado, acao: base('responder_preco', { conteudo: { modo: 'literal', texto: ['Pra anúncio, o valor é personalizado e o Bruno passa na call. Já o Google Meu Negócio tem valor fixo.', ...blocosDe(pe.pergunta)] } }) }
    }
    if (ehOutraFrente) {
      // Achado real, lead Carlos/conv530 (revenda de veículos), 02/10/2026: pediu preço 2x pra uma frente sem
      // valor fechado na config (gestão de anúncios) e recebeu a mesma frase as duas vezes. Primeira vez explica
      // por quê (precisa analisar o negócio antes de falar valor); pedido repetido vira lembrete curto, não o
      // texto inteiro de novo -- mesmo padrão já usado pra preço com escopo definido (linha ~475).
      if (estado.contadores.outra_frente_valor_explicado) {
        const a = base('responder_preco', { conteudo: { modo: 'livre', texto: 'Como te falei, preciso analisar seu negócio antes de fechar um valor -- é o Bruno quem faz essa análise com você.' } })
        a.contexto.push('Você já explicou isso nesta conversa. Relembre em uma frase curta, sem repetir o texto todo.')
        return { estado, acao: comPergunta(a) }
      }
      estado.contadores.outra_frente_valor_explicado = true
      return {
        estado,
        acao: comPergunta(base('responder_preco', { conteudo: { modo: 'literal', texto: 'Pra essa frente, preciso analisar o seu negócio antes de poder falar de valores com precisão -- é o Bruno quem faz essa análise e te passa o número certo pro seu caso.' } })),
      }
    }
    if (pe && opcao) {
      // Achado real, lead Rose/63551, 05/10/2026: o valor saiu com ramo e cidade ainda não informados. Valor só
      // depois da qualificação completa; antes disso segue a próxima pergunta de qualificação.
      // Achado real, lead Cris/5591984385343, 06/10/2026: pediu o valor 3x e nunca recebeu, porque esta trava
      // segurava o preço mesmo com pedido explícito. Pedido explícito de valor sempre é respondido.
      if (!completa && !(I.has('pergunta_preco') && pedeuPrecoDeVerdade)) return { estado, acao: comPergunta(base('perguntar')) }
      estado.pedidos_de_preco += 1
      // Texto fixo de preço nunca termina em pergunta de call: achado real, lead Rose/63551, 05/10/2026, o convite
      // "topa marcar 15 minutos?" saiu junto com o preço sem o lead ter pedido reunião. Quem pergunta é o decisor.
      const blocosPreco = blocosDe(opcao.texto).filter((b) => !b.trim().endsWith('?'))
      // Mesmo escopo, valor já enviado: não despeja o texto inteiro de novo (achado real, conv 530, 28/09: preço
      // idêntico 2x seguidas). Relembra curto, com os mesmos números (o validador confere que não mudou nada).
      if (estado.contadores.preco_enviado === opcao.valor) {
        const a = base('responder_preco', { conteudo: { modo: 'livre', texto: asArr(blocosDe(opcao.texto))[0] } })
        a.contexto.push('Você já passou esse valor nesta conversa. Relembre em uma frase curta, começando com algo como "Como te passei", sem repetir o texto todo e sem mudar nenhum número.')
        return { estado, acao: comPergunta(a) }
      }
      estado.contadores.preco_enviado = opcao.valor
      return { estado, acao: comPergunta(base('responder_preco', { conteudo: { modo: 'literal', texto: blocosPreco } })) }
    }
    estado.pedidos_de_preco += 1
    if (estado.pedidos_de_preco >= config.preco.escalar_apos) return escalar('lead insistiu em saber o valor')
    if (pe) {
      marcarEscopoPerguntado()
      // Reconhece a pergunta antes de pedir o escopo, em vez de ir seco direto pra pergunta (achado real,
      // Rodrigo revisando o lead Anderson, 01/10/2026). Só nesse caminho (pediu preço de verdade): nos outros
      // lugares que também perguntam escopo (combo com como_funciona, pede_pagamento) o reconhecimento não
      // cabe, por isso fica aqui, não dentro do texto de pe.pergunta.
      return { estado, acao: base('responder_preco', { conteudo: { modo: 'literal', texto: ['Excelente pergunta! A gente tem soluções que se adaptam ao momento de cada negócio, por isso o valor depende do escopo.', ...blocosDe(pe.pergunta)] } }) }
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
    // Achado real, lead Henrique/5511949638123, 06/10/2026: ele respondeu o orçamento ("ainda não tenho, tô no
    // começo") e o extrator marcou de novo a objeção retorno_imediato, já respondida. Saiu a frase fixa
    // "quer que eu chame o Bruno?" e a resposta dele foi ignorada. Objeção JÁ respondida + campo de qualificação
    // preenchido agora = o lead respondeu a pergunta, não repetiu a objeção: segue o fluxo. Fica de fora:
    // objeção que conta como recusa e qualquer turno com intenção de recusa (esses mantêm a frase de sempre).
    const trouxeDadoNovo = Object.entries(ex.dados ?? {}).some(([campo, v]) => typeof v === 'string' && v.trim() && !(entrada.dados[campo] ?? '').trim())
    const pularRepetida = !!obj && estado.objecoes_respondidas.includes(obj.id) && !obj.conta_como_recusa && !I.has('recusa') && trouxeDadoNovo
    if (obj && !pularRepetida) {
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

  // 7b. pagamento/dados de contrato: prioridade MAIOR que pergunta_fato (regra 8 logo abaixo). Achado real,
  // lead Ana/conv63358, 02/10/2026: ela pediu "quais os dados" e "chave Pix" junto numa mensagem só, o extrator
  // marcou pede_pagamento E pergunta_fato ao mesmo tempo, e como pergunta_fato rodava primeiro (antes dessa
  // mudança), a resposta genérica de fato vencia e a escalada de pagamento nunca disparava — o bot respondeu
  // "não tenho essa lista" em vez de escalar de verdade pro humano. Pedido de pagamento/contrato é sempre
  // prioridade: nunca deixa outra regra responder por cima.
  if (I.has('pede_pagamento')) {
    if (!ctx.cobrancaAtiva) return escalar('lead pediu para pagar e a cobrança automática não está ativa')
    // Preço por escopo: nunca gera cobrança do valor fixo da config sem saber qual escopo (Start e Essencial têm valores diferentes)
    if (pe && !opcao) {
      marcarEscopoPerguntado()
      return { estado, acao: base('perguntar', { conteudo: { modo: 'literal', texto: blocosDe(pe.pergunta) } }) }
    }
    if (!filled(estado.dados, 'cpf_cnpj')) {
      return {
        estado,
        acao: base('perguntar', { proxima_pergunta: { id: 'cpf_cnpj', texto: 'Pra gerar o pagamento, preciso do seu CPF ou CNPJ. Pode me passar?' } }),
      }
    }
    return { estado, acao: base('gerar_cobranca') }
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
      // Achado real, lead Daiane/conv538, 03/10/2026: ela disse "posso conversar amanhã? Tô caindo de sono" --
      // o extrator corretamente marcou quer_agendar E pede_espera juntos, mas essa regra rodava primeiro e
      // colava a próxima pergunta de qualificação de qualquer jeito, ignorando o pedido de espera. O SDR
      // respondeu "Claro, descansa 😊" e emendou a pergunta na mesma respirada -- contradição na cara do lead.
      if (I.has('pede_espera')) return { estado, acao: base('aguardar') }
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
          conteudo: { modo: 'livre', texto: `Show, vamos fechar! Só preciso do seu ${falta.join(' e ')}.` },
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

  // Não entendeu a mensagem do lead: pede pra repetir a dúvida, em vez de emendar a próxima pergunta do roteiro
  // (achado real, Rodrigo, 05/10/2026: lead perguntou "Como seria?" e o SDR respondeu com outra pergunta, ignorando).
  // Só reformula quando o lead SINALIZA confusão de fato. "Outro" genérico (ex.: "beleza", "ok") ou dúvida que o
  // extrator não reconheceu não entram aqui: pedir desculpa por confusão nesses casos seria erro.
  const NAO_ENTENDI_RE = /\b(nao entendi|nao entendo|nao compreendi|nao consegui entender|nao ficou claro|nao sei o que|como assim|o que voce quis dizer|hein)\b|^\s*\?+\s*$/
  const sinalConfusao = NAO_ENTENDI_RE.test(norm(ctx.mensagemLead ?? ''))
  const naoEntendeu = I.has('outro') && ex.intencoes.every((i) => i === 'outro' || i === 'social') && !I.has('social') && sinalConfusao
  // Reformula a última pergunta em linguagem simples, com desculpa curta. Não escala na primeira vez: quem decide
  // se passa pro Bruno é a regra de "não entendi 3x seguidas" lá em cima.
  // Achado real, lead Guilherme/63558, 05/10/2026: "Você que decide sobre esse tipo de investimento" (juridiquês)
  // não foi entendido e o SDR escalou em vez de traduzir a pergunta.
  if (naoEntendeu && !abertura && !temDado) {
    const a = base('perguntar')
    a.contexto.push('O lead disse que não entendeu sua última pergunta. Comece com uma desculpa curta ("Desculpa, deixei meio confuso") e refaça a pergunta em palavras simples do dia a dia, sem jargão nem termo corporativo. Não escale e não mude de assunto.')
    return { estado, acao: comPergunta(a) }
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
