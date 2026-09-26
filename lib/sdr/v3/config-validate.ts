/**
 * Validação da CompanyConfig ao salvar (spec seção 7). Função pura.
 * Bloqueia (erros) o que quebraria o motor ou contradiz as regras da própria config; avisa o que só merece revisão.
 */
import { PLACEHOLDERS_VALIDOS, type CompanyConfig } from './config-types'

export interface ConfigValidation {
  erros: string[]
  avisos: string[]
}

const EM_DASH_RE = /[—–]/
const BRACKET_RE = /\[[^\]]*\]/
const VALOR_RE = /R\$\s?\d|\d[\d.,]*\s*reais\b|\bmil\s+reais\b/i
const ACOES = new Set(['aguardar', 'voltar_qualificacao', 'encerrar', 'escalar'])

const norm = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const asArray = (v: string | string[] | undefined | null): string[] => (Array.isArray(v) ? v : v ? [v] : [])
const frases = (t: string) => t.split(/(?<=[.!?…])\s+/).filter((f) => f.trim()).length

export function validateCompanyConfig(raw: unknown): ConfigValidation {
  const erros: string[] = []
  const avisos: string[] = []
  if (!raw || typeof raw !== 'object') return { erros: ['Configuração inválida.'], avisos }
  const c = raw as Partial<CompanyConfig>

  if (!Number.isInteger(c.version) || (c.version as number) < 1) erros.push('Versão da configuração inválida.')

  // ── persona
  const p = c.persona
  if (!p || !p.nome_agente?.trim() || !p.empresa?.trim() || !p.tom?.trim()) avisos.push('Persona incompleta: preencha nome do agente, empresa e tom.')

  const proibidas = (c.palavras_proibidas ?? []).map(norm).filter(Boolean)
  const podeInformarPreco = c.preco?.pode_informar === true

  // Todo texto que vai (ou pode ir) para o lead
  const textos: { label: string; texto: string }[] = []
  const add = (label: string, t: string | string[] | undefined | null) => asArray(t).forEach((x, i) => textos.push({ label: i > 0 ? `${label} (bloco ${i + 1})` : label, texto: x }))

  // ── qualificação
  const perguntas = c.qualificacao?.perguntas ?? []
  if (perguntas.length === 0) erros.push('Cadastre pelo menos uma pergunta de qualificação.')
  const idsP = new Set<string>()
  const ordens = new Set<number>()
  perguntas.forEach((q) => {
    if (!q.id?.trim()) erros.push('Pergunta de qualificação sem id.')
    else if (idsP.has(q.id)) erros.push(`Pergunta duplicada: ${q.id}.`)
    idsP.add(q.id)
    if (q.obrigatoria && !q.campo?.trim()) erros.push(`Pergunta obrigatória sem campo: ${q.id}.`)
    if (!q.texto?.trim()) erros.push(`Pergunta sem texto: ${q.id}.`)
    if (ordens.has(q.ordem)) erros.push(`Duas perguntas com a mesma ordem (${q.ordem}).`)
    ordens.add(q.ordem)
    add(`Pergunta ${q.id}`, q.texto)
  })
  const obrigatorias = perguntas.filter((q) => q.obrigatoria).length
  if (obrigatorias > 5) avisos.push(`${obrigatorias} perguntas obrigatórias: acima de 5 a conversa vira interrogatório.`)
  if (perguntas.length > 0 && obrigatorias === 0) avisos.push('Nenhuma pergunta obrigatória: a qualificação nunca será considerada completa.')

  // ── objeções
  const objecoes = c.objecoes ?? []
  const idsO = new Set<string>()
  const gatilhoPorPrioridade = new Map<string, string>()
  objecoes.forEach((o) => {
    if (!o.id?.trim()) return void erros.push('Objeção sem id.')
    if (idsO.has(o.id)) erros.push(`Objeção duplicada: ${o.id}.`)
    idsO.add(o.id)
    if (!ACOES.has(o.proxima_acao)) erros.push(`Objeção ${o.id}: próxima ação inválida (${o.proxima_acao}).`)
    if (!Array.isArray(o.gatilhos) || o.gatilhos.length === 0) erros.push(`Objeção ${o.id}: cadastre pelo menos um gatilho.`)
    if (asArray(o.resposta).length === 0 || asArray(o.resposta).some((r) => !r.trim())) erros.push(`Objeção ${o.id}: resposta vazia.`)
    if (o.modo !== 'literal' && o.modo !== 'livre') erros.push(`Objeção ${o.id}: modo deve ser literal ou livre.`)
    for (const g of o.gatilhos ?? []) {
      const k = `${o.prioridade}::${norm(g)}`
      const outro = gatilhoPorPrioridade.get(k)
      if (outro && outro !== o.id) erros.push(`Gatilho "${g}" repetido nas objeções ${outro} e ${o.id} com a mesma prioridade.`)
      else gatilhoPorPrioridade.set(k, o.id)
    }
    add(`Objeção ${o.id}`, o.resposta)
    if (o.resposta_sem_dado) add(`Objeção ${o.id} (sem ${o.resposta_sem_dado.campo})`, o.resposta_sem_dado.resposta)
    if (o.modo === 'literal') {
      const n = asArray(o.resposta).reduce((s, r) => s + frases(r), 0)
      if (n > 3) avisos.push(`Objeção ${o.id} é literal e tem ${n} frases: acima de 3 o texto fica longo para copiar.`)
    }
  })

  // ── preço
  const preco = c.preco
  if (!preco) erros.push('Configure a política de preço.')
  else {
    if (!Number.isInteger(preco.escalar_apos) || preco.escalar_apos < 1) erros.push('Preço: "escalar após" deve ser 1 ou mais.')
    if (asArray(preco.frases_antes_qualificacao).length === 0) erros.push('Preço: cadastre pelo menos uma frase para antes da qualificação.')
    if (!preco.frase_depois_qualificacao?.trim()) erros.push('Preço: falta a frase para depois da qualificação.')
    add('Preço, antes da qualificação', preco.frases_antes_qualificacao)
    add('Preço, depois da qualificação', preco.frase_depois_qualificacao)
  }

  // ── demais frases
  if (!Number.isInteger(c.limites?.recusas_para_encerrar) || (c.limites?.recusas_para_encerrar as number) < 1) erros.push('Limites: "recusas para encerrar" deve ser 1 ou mais.')
  if (!c.escala?.frase?.trim() || !c.escala?.frase_duvida?.trim() || !c.escala?.nome_humano?.trim()) erros.push('Escala: preencha a frase, a frase de dúvida e o nome de quem assume.')
  if (!c.identidade?.frase_robo?.trim()) erros.push('Identidade: falta a frase para "você é um robô?".')
  if (!c.fora_escopo?.frase?.trim()) erros.push('Fora do escopo: falta a frase.')
  add('Escala', c.escala?.frase)
  add('Escala, dúvida', c.escala?.frase_duvida)
  add('Identidade', c.identidade?.frase_robo)
  add('Fora do escopo', c.fora_escopo?.frase)
  add('Ligação, oferta', c.ligacao?.oferta)
  add('Ligação, confirmação', c.ligacao?.confirmacao)
  add('Agradecimento', c.agradecimento_fim?.frase)
  add('Objeção repetida', c.objecao_repetida?.frase)
  add('Encerramento por recusas', c.encerramento_recusas?.frase)
  ;(c.fatos ?? []).forEach((f) => add(`Fato ${f.id}`, f.texto))

  // ── regras que valem para TODO texto da própria config
  const phOk = new Set<string>(PLACEHOLDERS_VALIDOS)
  for (const { label, texto } of textos) {
    if (EM_DASH_RE.test(texto)) erros.push(`${label}: não use travessão.`)
    if (BRACKET_RE.test(texto)) erros.push(`${label}: não use colchetes (para variáveis use chaves, ex.: {segmento}).`)
    for (const m of texto.matchAll(/\{([^}]*)\}/g)) if (!phOk.has(m[1])) erros.push(`${label}: variável desconhecida {${m[1]}}.`)
    if (!podeInformarPreco && VALOR_RE.test(texto)) erros.push(`${label}: tem valor em reais, mas a empresa não pode informar preço.`)
    const t = norm(texto)
    for (const w of proibidas) if (t.includes(w)) erros.push(`${label}: usa a palavra proibida "${w}".`)
    const max = c.limites?.max_frases_por_mensagem
    if (max && !label.startsWith('Fato') && frases(texto) > max) avisos.push(`${label}: mais de ${max} frases em um bloco.`)
  }

  if (c.agendamento?.ativo && !c.agendamento.calendario_id) avisos.push('Agendamento ativo sem calendário informado.')

  return { erros: [...new Set(erros)], avisos: [...new Set(avisos)] }
}
