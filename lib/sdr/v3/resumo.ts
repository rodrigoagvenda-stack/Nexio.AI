/**
 * Resumo executivo do lead (campo `leads.resumo_ia`), exibido no LeadInfoSidebar do painel de
 * atendimento. O motor antigo mantinha isso com um sub-agente de 3 ferramentas (Think4 → Buscar_lead →
 * Atualizar_resumo) decidindo a cada turno se havia novidade. O v3 nunca escrevia nesse campo (achado
 * 27/09/2026: resumo_ia ficava sempre null pra qualquer lead do v3, mesmo em conversas ricas).
 *
 * Aqui quem decide se vale gastar a chamada é o código (ver gate em turn.ts), não o modelo: mais barato
 * e mais no espírito do v3 (código decide, IA só escreve). O modelo só decide, dentro da chamada, se o
 * QUE ACONTECEU NESTE TURNO tem conteúdo narrativo novo o bastante pra atualizar o resumo.
 */
import type OpenAI from 'openai'
import type { createServiceClient } from '@/lib/supabase/server'
import { chatV3 } from './extractor'

type Supabase = ReturnType<typeof createServiceClient>

const SCHEMA = {
  type: 'object',
  properties: {
    tem_novidade: { type: 'boolean' },
    resumo_ia: { type: ['string', 'null'] },
  },
  required: ['tem_novidade', 'resumo_ia'],
  additionalProperties: false,
} as const

export async function atualizarResumoIA(
  openai: OpenAI,
  supabase: Supabase,
  p: { companyId: number; leadId: number; resumoAtual: string | null; mensagemLead: string; respostaSdr: string; dadosNovos: Record<string, string> },
  onUsage?: (c: OpenAI.Chat.ChatCompletion, agent: string) => void,
): Promise<void> {
  try {
    const novidades = Object.entries(p.dadosNovos).filter(([, v]) => v?.trim())
    const completion = await chatV3(openai, {
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: 'json_schema', json_schema: { name: 'resumo', strict: true, schema: SCHEMA as any } },
      messages: [
        {
          role: 'system',
          content: `Você mantém o resumo executivo de um lead de WhatsApp pra um vendedor ler em 30 segundos.
REGRAS:
- Máximo 200 palavras, em bullet points, em português.
- Inclua: interesse demonstrado, objeções, próximos passos, informações relevantes (nome, ramo, dados de qualificação, horário combinado).
- Priorize informação nova sobre antiga; não repita o resumo anterior palavra por palavra, atualize-o incorporando o que mudou.
- tem_novidade=false e resumo_ia=null quando este turno não trouxe NADA narrativo genuinamente novo (ex.: só um "ok"/"obrigado" sem informação). Nunca escreva "nada de novo"/"aguardando mais interações" só pra preencher o campo.
- tem_novidade=true: devolva o resumo COMPLETO já atualizado (não só a novidade isolada).`,
        },
        {
          role: 'user',
          content: `RESUMO ATUAL:\n${p.resumoAtual?.trim() || '(nenhum ainda)'}\n\nNESTE TURNO:\nLead disse: ${p.mensagemLead}\nSDR respondeu: ${p.respostaSdr}\n${novidades.length ? `Dados novos capturados: ${novidades.map(([k, v]) => `${k}=${v}`).join(', ')}` : ''}`,
        },
      ],
    }, 'resumo')
    onUsage?.(completion, 'v3_resumo_ia')
    const raw = JSON.parse(completion.choices[0]?.message?.content || '{}')
    if (!raw.tem_novidade || typeof raw.resumo_ia !== 'string' || !raw.resumo_ia.trim()) return
    await supabase.from('leads').update({ resumo_ia: raw.resumo_ia.trim(), updated_at: new Date().toISOString() }).eq('id', p.leadId).eq('company_id', p.companyId)
  } catch (err: any) {
    console.error(`[SDR v3:${p.companyId}] atualizarResumoIA falhou (ignorado, nunca derruba o turno):`, err?.message)
  }
}
