import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { rateLimit } from '@/lib/rate-limit'
import { runTenantSelfTestStream } from '@/lib/sdr/eval'

export const runtime = 'nodejs'
export const maxDuration = 280

// POST /api/sdr/self-test : o próprio cliente testa o SDR configurado por
// ELE, contra o motor real (processSdrMessage), numa empresa-sombra isolada
// (lib/sdr/qa-shadow.ts) que espelha o wizard atual sem tocar em lead/
// conversa real nenhuma. Streaming (SSE) : cada cenário chega assim que
// termina, em vez de segurar a resposta calada por até 2min (o teste roda
// sequencial de propósito, ver lib/sdr/eval.ts) e estourar timeout de proxy.
export async function POST(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const rl = rateLimit({ key: `sdr:self-test:${context.companyId}`, limit: 10, windowMs: 60 * 60_000 })
  if (!rl.success) {
    return new Response(JSON.stringify({ error: 'Limite de testes atingido. Tente novamente em 1 hora.' }), { status: 429 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }
      try {
        const result = await runTenantSelfTestStream(context.companyId, (report) => {
          send({ type: 'scenario', report })
        })
        send({ type: 'done', passou: result.passou, resumo: result.resumo })
      } catch (err: any) {
        console.error('[api/sdr/self-test]', err)
        send({ type: 'error', message: err?.message ?? 'Erro ao testar o SDR' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
