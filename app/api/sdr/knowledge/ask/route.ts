import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { resolveOpenAIKey } from '@/lib/sdr/rag'
import { searchDocuments } from '@/lib/sdr/engine'
import { answerFromKnowledge } from '@/lib/sdr/funnel/box'

export const runtime = 'nodejs'
export const maxDuration = 60

const schema = z.object({ question: z.string().min(2).max(500) })

// Pergunta de teste: o agente responde só com o que está na base, do mesmo jeito que responde um lead. Nada é enviado a ninguém.
export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error

  const rl = rateLimit({ key: `sdr:knowledge-ask:${context.companyId}`, limit: 60, windowMs: 60 * 60_000 })
  if (!rl.success) return NextResponse.json({ error: 'Limite de perguntas de teste atingido. Tente novamente em 1 hora.' }, { status: 429 })

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 422 })

  let apiKey: string
  try { apiKey = await resolveOpenAIKey(context.companyId) } catch { return NextResponse.json({ error: 'A leitura da base não está disponível agora. Fale com o suporte.' }, { status: 422 }) }
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey })
  const supabase = createServiceClient()

  const answer = await answerFromKnowledge({
    question: parsed.data.question,
    openai,
    search: (q) => searchDocuments(q, context.companyId, openai, supabase, 'conhecimento'),
  })
  return NextResponse.json({ answer })
}
