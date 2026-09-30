/**
 * SDR v3: templates de automação passam pelo mesmo validador ao serem salvos no canvas (spec seção 6, última linha).
 * Bloqueia salvar com V4 (valor quando a empresa não pode informar preço) e V5 (palavra proibida da config).
 */
import type { CompanyConfig } from './config-types'
import { VALOR_RE, contemProibida, norm } from './validator'

/** Todos os textos de um passo (mensagem + pool, que pode vir como lista de strings ou de objetos). */
export function textosDoPasso(step: { mensagem?: unknown; pool_mensagens?: unknown }): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') { if (v.trim()) out.push(v) }
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(step.mensagem)
  walk(step.pool_mensagens)
  return out
}

export function violacoesTemplate(texto: string, config: CompanyConfig): string[] {
  const v: string[] = []
  const n = norm(texto)
  const proibida = (config.palavras_proibidas ?? []).find((p) => contemProibida(n, p))
  if (proibida) v.push(`palavra proibida "${proibida.replace(/^=/, '')}"`)
  if (!config.preco.pode_informar && VALOR_RE.test(texto)) v.push('valor em R$ (a empresa não informa preço por mensagem)')
  return v
}

/** Mensagem de erro pronta pra tela, ou null quando todos os passos passam. */
export function checarPassos(steps: { mensagem?: unknown; pool_mensagens?: unknown }[], config: CompanyConfig): string | null {
  const erros: string[] = []
  steps.forEach((s, i) => {
    for (const t of textosDoPasso(s)) {
      const v = violacoesTemplate(t, config)
      if (v.length) erros.push(`Passo ${i + 1}: ${v.join(' e ')} em "${t.slice(0, 60)}${t.length > 60 ? '…' : ''}"`)
    }
  })
  return erros.length ? `Não salvei: o texto contradiz as regras do SDR. ${erros.join('; ')}.` : null
}
