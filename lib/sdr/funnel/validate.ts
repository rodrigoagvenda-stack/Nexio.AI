/**
 * Validação estrita da config do funil antes de salvar (rota de API e wizard).
 * Função pura. O runner tem só uma checagem leve na leitura; aqui é o portão
 * que impede uma config quebrada de chegar no banco.
 */
import type { FunnelConfig } from './types'

const MAX_TEXT = 1500
const MAX_STEPS = 15
const EM_DASH_RE = /[—–]/
const BRACKET_RE = /\[[^\]]*\]/ // pedido do dono do produto : nenhum [texto] em texto visível ao lead

function isStr(v: unknown): v is string {
  return typeof v === 'string'
}

/** Devolve lista de erros em português (vazia = válida). */
export function validateFunnelConfig(raw: unknown): string[] {
  const errors: string[] = []
  if (!raw || typeof raw !== 'object') return ['Configuração inválida.']
  const c = raw as Partial<FunnelConfig>

  const visible = (label: string, text: unknown, required = true) => {
    if (text === undefined || text === null || text === '') {
      if (required) errors.push(`${label}: texto obrigatório.`)
      return
    }
    if (!isStr(text)) return void errors.push(`${label}: texto inválido.`)
    if (text.length > MAX_TEXT) errors.push(`${label}: passou de ${MAX_TEXT} caracteres.`)
    if (EM_DASH_RE.test(text)) errors.push(`${label}: não use travessão, troque por dois pontos ou vírgula.`)
    if (BRACKET_RE.test(text)) errors.push(`${label}: não use colchetes no texto.`)
  }

  if (c.version !== 1) errors.push('Versão da configuração inválida.')
  if (!Array.isArray(c.steps) || c.steps.length === 0) return [...errors, 'Cadastre pelo menos um passo.']
  if (c.steps.length > MAX_STEPS) errors.push(`No máximo ${MAX_STEPS} passos.`)

  const stepIds = new Set<string>()
  const fieldKeys = new Set<string>()
  c.steps.forEach((s, i) => {
    const at = `Passo ${i + 1}`
    if (!s || !isStr(s.id) || !/^[a-z0-9_]{1,40}$/.test(s.id)) return void errors.push(`${at}: identificador inválido.`)
    if (stepIds.has(s.id)) errors.push(`${at}: identificador repetido.`)
    stepIds.add(s.id)
    visible(`${at} (pergunta)`, s.question)
    visible(`${at} (pergunta de reforço)`, s.clarify, false)
    visible(`${at} (pergunta parcial)`, s.partialQuestion, false)
    if (s.maxAsks !== undefined && (!Number.isInteger(s.maxAsks) || s.maxAsks < 1 || s.maxAsks > 6)) {
      errors.push(`${at}: tentativas devem ser de 1 a 6.`)
    }
    if (!Array.isArray(s.fields) || s.fields.length === 0) return void errors.push(`${at}: precisa de pelo menos um dado a coletar.`)
    let hasRequired = false
    for (const f of s.fields) {
      if (!f || !isStr(f.key) || !/^[a-z][a-z0-9_]{0,40}$/.test(f.key)) {
        errors.push(`${at}: nome de campo inválido.`)
        continue
      }
      if (fieldKeys.has(f.key)) errors.push(`${at}: campo "${f.key}" repetido em outro passo.`)
      fieldKeys.add(f.key)
      if (!['text', 'yesno', 'link_or_media'].includes(f.type)) errors.push(`${at}: tipo do campo "${f.key}" inválido.`)
      if (!isStr(f.label) || !f.label.trim()) errors.push(`${at}: campo "${f.key}" sem descrição curta.`)
      if (!isStr(f.description) || !f.description.trim()) errors.push(`${at}: campo "${f.key}" sem instrução de leitura.`)
      if (f.required !== false) hasRequired = true
    }
    if (!hasRequired) errors.push(`${at}: precisa de pelo menos um dado obrigatório.`)
  })

  c.steps.forEach((s, i) => {
    if (s?.followUp) {
      const fu = s.followUp
      if (!fieldKeys.has(fu.whenField) || !fieldKeys.has(fu.missingField)) errors.push(`Passo ${i + 1}: pergunta extra aponta pra campo que não existe.`)
      visible(`Passo ${i + 1} (pergunta extra)`, fu.question)
    }
  })

  visible('Resposta de recusa', c.refusalReply)
  visible('Resposta de despedida', c.farewellReply)
  visible('Resposta quando não sabe', c.unknownAnswer)
  visible('Texto de espera ao passar pra uma pessoa', c.handoff?.waitMessage)
  visible('Texto do preço insistente', c.priceInsistHandoff)
  visible('Oferta de ligação', c.callOffer, false)
  visible('Confirmação de ligação', c.callConfirm, false)
  visible('Resposta quando o lead está ocupado', c.deferReply, false)
  visible('Mensagem ao terminar as perguntas', c.closingMessage, false)
  if (typeof c.deferReply === 'string' && c.deferReply.includes('?')) {
    errors.push('Resposta quando o lead está ocupado: não faça pergunta nesse texto.')
  }

  if (!Array.isArray(c.priceScripts)) errors.push('Respostas de preço inválidas.')
  else c.priceScripts.forEach((t, i) => {
    visible(`Resposta de preço ${i + 1}`, t)
    if (isStr(t) && /R\$\s?\d/.test(t)) errors.push(`Resposta de preço ${i + 1}: não coloque valor em reais aqui.`)
  })

  if (!c.objections || typeof c.objections !== 'object') errors.push('Objeções inválidas.')
  else {
    for (const [key, o] of Object.entries(c.objections)) {
      if (!/^[a-z0-9_]{1,40}$/.test(key)) errors.push(`Objeção "${key}": identificador inválido.`)
      if (!o || !isStr(o.triggers) || !o.triggers.trim()) errors.push(`Objeção "${key}": descreva como o lead costuma dizer isso.`)
      if (!o || !['objecao', 'faq'].includes(o.kind)) errors.push(`Objeção "${key}": tipo inválido.`)
      if (!o || !Array.isArray(o.scripts) || o.scripts.length === 0) errors.push(`Objeção "${key}": cadastre pelo menos uma resposta.`)
      else o.scripts.forEach((t, i) => visible(`Objeção "${key}" resposta ${i + 1}`, t))
    }
  }

  if (!Number.isInteger(c.maxObjections) || (c.maxObjections as number) < 1 || (c.maxObjections as number) > 5) {
    errors.push('Limite de objeções deve ser de 1 a 5.')
  }
  return errors
}
