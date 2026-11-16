import { NextResponse } from 'next/server'
import { listarRetomada, executarRetomada } from '@/lib/sdr/retomada-sem-credito'
import { syslog } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Máximo de conversas por chamada: cada resposta tem atraso humano de digitação, e a chamada tem 5 minutos. */
const LOTE_MAX = 5

/**
 * POST /api/cron/retomada-sem-credito (disparo MANUAL, nunca agendado em pg_cron)
 * body: { companyId, desde, modo: 'listar' }                       -> só lê
 *       { companyId, desde, modo: 'executar', conversas: [ids] }  -> responde só essas (até LOTE_MAX)
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const companyId = Number(body.companyId)
  const desde = typeof body.desde === 'string' ? body.desde : ''
  if (!Number.isFinite(companyId) || !desde || Number.isNaN(Date.parse(desde))) {
    return NextResponse.json({ error: 'companyId e desde (data ISO) são obrigatórios' }, { status: 400 })
  }

  try {
    if (body.modo === 'listar') {
      return NextResponse.json({ ok: true, ...(await listarRetomada(companyId, desde)) })
    }
    if (body.modo === 'executar') {
      const conversas: number[] = Array.isArray(body.conversas) ? body.conversas.map(Number).filter(Number.isFinite) : []
      if (conversas.length === 0 || conversas.length > LOTE_MAX) {
        return NextResponse.json({ error: `conversas: de 1 a ${LOTE_MAX} ids aprovados` }, { status: 400 })
      }
      const resultado = await executarRetomada(companyId, desde, conversas)
      await syslog({ type: 'retomada_sem_credito', severity: 'info', message: `Retomada: ${resultado.length} conversa(s)`, payload: { companyId, resultado } })
      return NextResponse.json({ ok: true, resultado })
    }
    return NextResponse.json({ error: "modo: 'listar' ou 'executar'" }, { status: 400 })
  } catch (err: any) {
    await syslog({ type: 'retomada_sem_credito', severity: 'error', message: `retomada falhou: ${err.message}`, payload: { companyId } })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
