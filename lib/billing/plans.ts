// Fonte única dos planos e do pacote de tokens. Landing, tela de planos, ajuda, checkout e webhook leem daqui.
// Decidido por Rodrigo em 25/09/2026: dois planos (Start e Growth), um número de WhatsApp em todos,
// Outbound e Orbit fora dos planos, excedente vendido em pacote de tokens.
import type { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

/** Preço do milhão de tokens extra, em reais. R$ 45 compra 3 milhões (decisão de Rodrigo, 25/09/2026). Trocar aqui muda checkout, tela de plano e modal. */
export const TOKEN_PRICE_PER_MILLION_BRL = 15

/** Consumo medido na Grupo Venda (04 a 25/09/2026): teto, inclui testes. Só serve para estimar conversas. */
export const TOKENS_PER_CONVERSATION = 84_000

export const PLAN_TOKENS_MONTHLY: Record<'starter' | 'pro', number> = {
  starter: 5_000_000,
  pro: 15_000_000,
}

export function tokensForAmount(amountBrl: number): number {
  return Math.round((amountBrl / TOKEN_PRICE_PER_MILLION_BRL) * 1_000_000)
}

export function priceForTokens(tokens: number): number {
  return Math.round((tokens / 1_000_000) * TOKEN_PRICE_PER_MILLION_BRL * 100) / 100
}

/** Conversas aproximadas para um volume de tokens, arredondado de 5 em 5. */
export function approxConversations(tokens: number): number {
  return Math.max(0, Math.round(tokens / TOKENS_PER_CONVERSATION / 5) * 5)
}

export const TOKEN_PACK_SIZES = [3_000_000, 6_000_000, 15_000_000, 30_000_000] as const

/** Valor mínimo de compra avulsa, em reais (o pacote de 3M). */
export const TOKEN_MIN_PURCHASE_BRL = priceForTokens(3_000_000)

/**
 * Funções ligadas por plano. Só entram na empresa quando o plano muda (assinatura nova ou troca),
 * e só nestas chaves: as demais flags (outbound, prospect, briefing...) continuam manuais.
 * Start precisa de canvas ligado para configurar o Anti noshow, que mora nele.
 */
export const PLAN_FEATURES: Record<'starter' | 'pro', Record<string, boolean>> = {
  starter: { anti_noshow: true, canvas: true, follow_up: false, remarketing: false, meta_ads: false, agenda: false },
  pro: { anti_noshow: true, canvas: true, follow_up: true, remarketing: true, meta_ads: true, agenda: true },
}

export async function applyPlanFeatures(supabase: Supabase, companyId: number, planType: string): Promise<void> {
  const managed = PLAN_FEATURES[planType as 'starter' | 'pro']
  if (!managed) return
  const { data: company } = await supabase.from('companies').select('features').eq('id', companyId).single()
  const current = (company?.features ?? {}) as Record<string, unknown>
  await supabase.from('companies').update({ features: { ...current, ...managed } }).eq('id', companyId)
}
