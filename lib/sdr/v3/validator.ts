/**
 * SDR v3: validador (spec seção 6). Funções puras: rodam sobre todo texto que sai.
 * V1 uma pergunta, V2 pergunta já respondida, V3 frase repetida, V4 valor, V5 palavra proibida,
 * V6 fato fora da fonte (registro), V7 vício de IA (registro), V8 tamanho, V9 travessão, V10 agendamento sem evento.
 * Regras da config: terminologia e nomear o humano.
 */
import type { CompanyConfig } from './config-types'
import type { Acao, Estado } from './types'

export type RegraId = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10' | 'TERMO' | 'HUMANO' | 'LITERAL'

export interface Violacao {
  regra: RegraId
  modo: 'bloqueia' | 'registro'
  detalhe: string
}

export interface ValidadorCtx {
  config: CompanyConfig
  estado: Estado
  acao: Acao
  /** Textos que o lead escreveu (para V6). */
  mensagensDoLead: string[]
  /** Últimas mensagens nossas, da mais recente para a mais antiga (para V7). */
  ultimasNossas: string[]
  /** true só quando o Calendar criou o evento neste turno. */
  eventoConfirmadoNoTurno: boolean
}

const VALOR_RE = /R\$\s?\d|\d[\d.,]*\s*reais\b|\bmil\s+reais\b/i
const AGENDAMENTO_RE = /\b(vou\s+agendar|j[aá]\s+agendei|agendei|(?:est[aá]|t[aá]|ficou|fica)\s+(?:agendad[oa]|marcad[oa])|reuni[aã]o\s+(?:est[aá]\s+)?confirmada|te\s+mando\s+o\s+link|vou\s+te\s+mandar\s+o\s+link|te\s+enviei\s+o\s+convite|convite\s+(?:foi\s+)?enviado)\b/i
const ABERTURAS = ['entendi', 'perfeito', 'otimo', 'show', 'claro', 'legal', 'beleza']
const ELOGIO_RE = /\b(?:boa|[oó]tima|excelente|[oó]timo)\s+pergunta\b/i
const JUSTIFICATIVA_RE = /\b(?:assim|pra|para)\s+(?:eu\s+)?(?:consigo|posso|poder|conseguir)\b|\bso\s+pra\s+(?:eu\s+)?entender\b|\bpra\s+te\s+ajudar\s+melhor\b/i
const ESPECIALISTA_RE = /\b(?:nosso|um|o)\s+especialista\b/i

export const norm = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

const tokens = (t: string) => norm(t).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0
  const sa = new Set(a)
  const sb = new Set(b)
  let inter = 0
  for (const t of sa) if (sb.has(t)) inter++
  return inter / (sa.size + sb.size - inter)
}

export const sentencas = (t: string) => t.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean)

export function contarPerguntas(blocos: string[]): number {
  return blocos.reduce((s, b) => s + (b.match(/\?/g) ?? []).length, 0)
}

export function validar(blocos: string[], v: ValidadorCtx): Violacao[] {
  const out: Violacao[] = []
  const texto = blocos.join('\n')
  const cfg = v.config
  const bloqueiaV6V7 = cfg.validador?.bloquear_v6_v7 === true
  const add = (regra: RegraId, detalhe: string, modo: Violacao['modo'] = 'bloqueia') => out.push({ regra, modo, detalhe })

  // V1 uma pergunta por rajada
  const nPerg = contarPerguntas(blocos)
  if (nPerg > 1) add('V1', `${nPerg} perguntas na rajada`)

  // V2 pergunta de qualificação cujo campo já está preenchido
  for (const q of cfg.qualificacao.perguntas) {
    if (!v.estado.dados[q.campo]?.trim()) continue
    const perguntasDoTexto = sentencas(q.texto).filter((s) => s.includes('?')).map(tokens)
    const perguntasDaSaida = blocos.flatMap(sentencas).filter((s) => s.includes('?')).map(tokens)
    if (perguntasDoTexto.some((tq) => tq.length >= 3 && perguntasDaSaida.some((tb) => jaccard(tb, tq) >= 0.6))) {
      add('V2', `repete a pergunta "${q.id}", que já foi respondida`)
    }
  }

  // V3 frase repetida (similaridade alta com o que já foi enviado)
  const jaEnviadas = v.estado.frases_enviadas.map(tokens)
  const literal = (v.acao.conteudo?.modo === 'literal' ? [v.acao.conteudo.texto].flat() : []).map(norm)
  for (const b of blocos) {
    for (const s of sentencas(b)) {
      const ts = tokens(s)
      if (ts.length < 4 || literal.some((l) => l.includes(norm(s)))) continue
      if (jaEnviadas.some((j) => jaccard(ts, j) >= 0.85)) {
        add('V3', `frase repetida: "${s.slice(0, 80)}"`)
        break
      }
    }
  }

  // V4 valor em reais quando a empresa não pode informar preço
  if (!cfg.preco.pode_informar && v.acao.tipo !== 'gerar_cobranca' && VALOR_RE.test(texto)) add('V4', 'valor em reais na resposta')

  // V5 palavra proibida
  const nt = norm(texto)
  for (const w of cfg.palavras_proibidas) if (norm(w) && nt.includes(norm(w))) add('V5', `palavra proibida "${w}"`)

  // V6 número, prazo ou porcentagem fora da fonte; nome próprio fora da fonte (registro)
  const fonte = norm(
    [
      ...v.acao.fatos.map((f) => f.texto),
      ...(v.acao.conteudo ? [v.acao.conteudo.texto].flat() : []),
      v.acao.proxima_pergunta?.texto ?? '',
      v.acao.bloco_fixo ?? '',
      ...v.acao.contexto,
      ...v.mensagensDoLead,
      cfg.persona.nome_agente,
      cfg.persona.empresa,
      cfg.persona.assinatura_humano,
      cfg.escala.nome_humano,
      ...Object.values(v.estado.dados),
    ].join(' '),
  )
  const foraDaFonte: string[] = []
  for (const n of texto.match(/\d+(?:[.,:]\d+)*(?:h\d*)?%?/g) ?? []) if (!fonte.includes(norm(n))) foraDaFonte.push(n)
  for (const s of sentencas(texto)) {
    const palavras = s.split(/\s+/).slice(1)
    for (const p of palavras) {
      const limpa = p.replace(/[^\p{L}]/gu, '')
      if (limpa.length > 2 && /^\p{Lu}\p{Ll}+$/u.test(limpa) && !fonte.includes(norm(limpa))) foraDaFonte.push(limpa)
    }
  }
  if (foraDaFonte.length > 0) add('V6', `fora da fonte: ${[...new Set(foraDaFonte)].slice(0, 6).join(', ')}`, bloqueiaV6V7 ? 'bloqueia' : 'registro')

  // V7 vício de IA: abertura repetida, elogio à pergunta, justificativa
  const abertura = norm(blocos[0] ?? '').split(/[\s,!.]+/)[0]
  if (ABERTURAS.includes(abertura) && v.ultimasNossas.slice(0, 3).some((m) => norm(m).split(/[\s,!.]+/)[0] === abertura)) {
    add('V7', `abertura repetida: "${abertura}"`, bloqueiaV6V7 ? 'bloqueia' : 'registro')
  }
  if (ELOGIO_RE.test(texto)) add('V7', 'elogio à pergunta', bloqueiaV6V7 ? 'bloqueia' : 'registro')
  if (JUSTIFICATIVA_RE.test(texto)) add('V7', 'justificativa de por que está perguntando', bloqueiaV6V7 ? 'bloqueia' : 'registro')

  // V8 tamanho
  if (blocos.length > 2) add('V8', `${blocos.length} blocos (máximo 2)`)
  if (blocos.some((b) => b.length > 350)) add('V8', 'bloco com mais de 350 caracteres')

  // V9 travessão
  if (/[—–]/.test(texto)) add('V9', 'travessão')

  // V10 agendamento afirmado sem evento criado neste turno
  if (!v.eventoConfirmadoNoTurno && AGENDAMENTO_RE.test(texto)) add('V10', 'afirma ou promete agendamento sem evento criado')

  // Config: terminologia e nomear o humano
  for (const t of cfg.validador?.terminologia ?? []) {
    const semExcecao = t.excecao ? nt.replace(new RegExp(norm(t.excecao.split('(')[0]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '') : nt
    if (semExcecao.includes(norm(t.evitar))) add('TERMO', `use "${t.usar}" em vez de "${t.evitar}"`)
  }
  if (cfg.validador?.nomear_humano && ESPECIALISTA_RE.test(texto) && !norm(texto).includes(norm(cfg.escala.nome_humano))) {
    add('HUMANO', `cite ${cfg.escala.nome_humano} pelo nome, não só "especialista"`)
  }
  return out
}

/** Correção mecânica (sem nova chamada ao modelo) para o que não é V4, V5, V6 ou V10. */
export function corrigirMecanico(blocos: string[], v: ValidadorCtx, violacoes: Violacao[]): string[] {
  let out = blocos.map((b) => b.trim()).filter(Boolean)
  const tem = (r: RegraId) => violacoes.some((x) => x.regra === r && x.modo === 'bloqueia')

  if (out.some((b) => /[—–]/.test(b))) out = out.map((b) => b.replace(/\s*[—–]\s*/g, ', '))

  for (const t of v.config.validador?.terminologia ?? []) {
    const ex = t.excecao ? t.excecao.split('(')[0].trim() : null
    out = out.map((b) => {
      if (!norm(b).includes(norm(t.evitar))) return b
      return ex && norm(b).includes(norm(ex)) ? b : b.replace(new RegExp(t.evitar, 'gi'), t.usar)
    })
  }

  if (tem('V1')) {
    let achou = false
    out = out
      .map((b) =>
        sentencas(b)
          .filter((s) => {
            if (!s.includes('?')) return true
            if (achou) return false
            achou = true
            return true
          })
          .join(' '),
      )
      .filter(Boolean)
  }

  if (tem('V8') && out.length > 2) out = [out[0], out[out.length - 1]]
  return out
}
