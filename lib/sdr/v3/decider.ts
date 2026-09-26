/**
 * SDR v3: decisor (spec seção 4). Função pura: extração + estado + config entram, ação + estado novo saem.
 * Nenhuma regra de negócio depende de o modelo lembrar: a ordem abaixo é a primeira regra que casar.
 */
import type { CompanyConfig, ObjecaoConfig } from './config-types'
import type { Acao, Estado, Etapa, Extracao } from './types'

export interface DecisorCtx {
  temCalendario: boolean
  cobrancaAtiva: boolean
  /** true quando ainda não saiu nenhuma mensagem nossa nesta conversa. */
  primeiraMensagemNossa: boolean
  pushName: string | null
  contextoOutbound: string | null
  origemAnuncio: string | null
  /** Data formatada da reunião já agendada e válida, se houver. */
  reuniaoExistente: string | null
}

export interface Decisao {
  acao: Acao
  estado: Estado
}

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

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
export function proximaPergunta(estado: Estado, config: CompanyConfig, abertura: boolean, ignorarJanela = false): { id: string; texto: string; reformulada: boolean } | null {
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
    return { id: q.id, texto: preencher(q.texto, estado.dados), reformulada: feitas.length > 0 }
  }
  return null
}

const ORDEM_ETAPA: Etapa[] = ['abertura', 'qualificando', 'oferta_horario', 'confirmando', 'agendado']
function etapaAvanca(atual: Etapa, alvo: Etapa): Etapa {
  if (atual === 'encerrado' || atual === 'escalado') return alvo
  return ORDEM_ETAPA.indexOf(alvo) > ORDEM_ETAPA.indexOf(atual) ? alvo : atual
}

const asArr = (v: string | string[]) => (Array.isArray(v) ? v : [v])

function novoPalpiteNome(pushName: string | null): string | null {
  if (!pushName) return null
  const p = pushName.trim()
  if (p.length < 2 || /[\d@_]/.test(p) || /[^\p{L}\s.'-]/u.test(p)) return null
  return firstName(p)
}

export function decidir(ex: Extracao, entrada: Estado, config: CompanyConfig, ctx: DecisorCtx): Decisao {
  const estado: Estado = JSON.parse(JSON.stringify(entrada))
  estado.turno += 1
  const turno = estado.turno

  // 0. merge dos dados (só o que o lead disse) e fechamento das perguntas respondidas
  for (const [k, v] of Object.entries(ex.dados ?? {})) if (typeof v === 'string' && v.trim()) estado.dados[k] = v.trim()
  const campoDe = (id: string) => config.qualificacao.perguntas.find((q) => q.id === id)?.campo
  for (const p of estado.perguntas_feitas) if (!p.respondida && campoDe(p.id) && filled(estado.dados, campoDe(p.id)!)) p.respondida = true

  const I = new Set(ex.intencoes)
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
  }

  const completa = qualificacaoCompleta(estado, config)
  const abertura = estado.etapa === 'abertura' && ctx.primeiraMensagemNossa

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

  const comPergunta = (a: Acao, permitir = true): Acao => {
    if (!permitir || completa) return a
    const q = proximaPergunta(estado, config, false)
    if (q) {
      a.proxima_pergunta = { id: q.id, texto: q.texto }
      if (q.reformulada) a.contexto.push('Esta pergunta já foi feita antes e não foi respondida: reformule com outras palavras, sem cobrar.')
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
  if (soAgradecimento && (estado.etapa === 'encerrado' || estado.etapa === 'agendado') && config.agradecimento_fim?.frase) {
    return { estado, acao: base('agradecimento_fim', { conteudo: { modo: 'literal', texto: config.agradecimento_fim.frase }, etapa_depois: estado.etapa }) }
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

  // 3. fora do escopo
  if (I.has('fora_do_escopo')) {
    return { estado, acao: comPergunta(base('responder_fora_escopo', { conteudo: { modo: 'literal', texto: config.fora_escopo.frase } })) }
  }

  // 4. preço
  if (I.has('pergunta_preco')) {
    estado.pedidos_de_preco += 1
    if (estado.pedidos_de_preco >= config.preco.escalar_apos) return escalar('lead insistiu em saber o valor')
    const antes = config.preco.frases_antes_qualificacao
    const frase = completa ? config.preco.frase_depois_qualificacao : antes[(estado.pedidos_de_preco - 1) % antes.length]
    return { estado, acao: comPergunta(base('responder_preco', { conteudo: { modo: 'literal', texto: frase } })) }
  }

  // 5. objeção
  if (I.has('objecao') && ex.objecao_id) {
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

  // 7. pede ligação
  if (I.has('pede_ligacao') && config.ligacao) {
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
  if (I.has('pergunta_fato') && ex.pergunta_fato) {
    const a = base('responder_fato', {
      consulta_rag: ex.pergunta_fato,
      fatos: (config.fatos ?? []).map((f) => ({ id: f.id, texto: f.texto })),
    })
    return { estado, acao: comPergunta(a) }
  }

  // 9. atalhos de agendamento: horário e/ou e-mail informados
  if (ctx.temCalendario && (I.has('escolheu_horario') || I.has('informou_email'))) {
    const nomeCompleto = estado.dados.nome_completo || (estado.dados.nome?.trim().split(/\s+/).length >= 2 ? estado.dados.nome : '')
    if (ex.horario_escolhido) estado.dados.horario_escolhido = ex.horario_escolhido
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

  // 10. quer agendar / qualificação completa
  if (ctx.temCalendario && ctx.reuniaoExistente && (I.has('quer_agendar') || completa)) {
    return {
      estado,
      acao: base('responder_fato', {
        fatos: [{ id: 'reuniao_existente', texto: `A reunião já está agendada para ${ctx.reuniaoExistente}. O convite com o link foi enviado por e-mail.` }],
        etapa_depois: 'agendado',
      }),
    }
  }
  if (I.has('quer_agendar') || completa) {
    if (!completa) {
      const a = base('perguntar')
      a.contexto.push('O lead quer agendar. Diga em meia frase que já vai ver o horário e faça a pergunta.')
      return { estado, acao: comPergunta(a) }
    }
    if (!ctx.temCalendario) return escalar('qualificação completa e a empresa não tem calendário')
    estado.contadores.horarios_ofertados = true
    return { estado, acao: base('oferecer_horarios', { etapa_depois: 'oferta_horario' }) }
  }

  // 11. pede espera
  if (I.has('pede_espera')) return { estado, acao: base('aguardar') }

  // 12. pagamento
  if (I.has('pede_pagamento')) {
    if (!ctx.cobrancaAtiva) return escalar('lead pediu para pagar e a cobrança automática não está ativa')
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
    if (q.reformulada) a.contexto.push('Esta pergunta já foi feita antes e não foi respondida: reformule com outras palavras, sem cobrar.')
  }
  if (abertura) {
    a.contexto.push(`Primeira mensagem da conversa: apresente-se pelo nome (${config.persona.nome_agente}) e pela empresa (${config.persona.empresa}).`)
    if (ctx.contextoOutbound) a.contexto.push(`O lead recebeu um disparo nosso antes: "${ctx.contextoOutbound}". Não se reapresente como se fosse o primeiro contato.`)
    if (ctx.origemAnuncio) a.contexto.push(`O lead chegou pelo anúncio: "${ctx.origemAnuncio}".`)
    const palpite = novoPalpiteNome(ctx.pushName)
    if (palpite && !filled(estado.dados, 'nome')) {
      a.contexto.push(`O nome no perfil do WhatsApp é "${palpite}", mas não é confiável: NÃO afirme. Se for perguntar o nome, confirme com "Falo com ${palpite}?".`)
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
