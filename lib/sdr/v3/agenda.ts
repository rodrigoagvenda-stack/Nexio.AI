/**
 * SDR v3: agendamento chamado pelo código, sem sub-agente (spec seção 2).
 * Mesmas travas do Agendar_gcal atual: folga mínima, no máximo 60 dias, reconferência do slot,
 * conflito com outro lead no CRM, e o CRM só é gravado depois de o evento existir.
 */
import type { createServiceClient } from '@/lib/supabase/server'
import { MIN_NOTICE_MINUTES } from '@/lib/slot-notice'
import { checkAvailableSlots, createEventWithMeet, formatDateTimeBR, getMeetingDurationMinutes, parseBrazilDateTime } from '@/lib/google-calendar'

type Supabase = ReturnType<typeof createServiceClient>

export interface AgendaCtx {
  companyId: number
  leadId: number
  leadPhone: string
  calendarId: string
  eventTitleTemplate: string | null
}

export interface Oferta {
  /** ISO local de Brasília sem fuso (ex.: 2026-10-01T14:00:00), para o extrator mapear a escolha do lead. */
  slots: string[]
  texto: string
}

const brt = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T')
const hora = (d: Date) => {
  const [h, m] = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).split(':')
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`
}
const diaIso = (d: Date) => brt(d).slice(0, 10)
const rotuloDia = (iso: string, hojeIso: string, amanhaIso: string) =>
  iso === hojeIso
    ? 'hoje'
    : iso === amanhaIso
      ? 'amanhã'
      : new Date(`${iso}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

/** Até 3 horários livres (hoje com folga de 1h e o próximo dia útil com vaga), espalhados. */
export async function ofertarHorarios(ctx: AgendaCtx): Promise<Oferta | null> {
  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
  const livres: Date[] = []
  const slotsHoje = await checkAvailableSlots({ calendarId: ctx.calendarId, date: new Date(hoje), companyId: ctx.companyId })
  livres.push(...slotsHoje.filter((s) => s.available).map((s) => s.start))
  for (let i = 1; i <= 7; i++) {
    const dia = new Date(new Date(`${hoje}T12:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10)
    const s = await checkAvailableSlots({ calendarId: ctx.calendarId, date: new Date(`${dia}T12:00:00Z`), companyId: ctx.companyId })
    const ok = s.filter((x) => x.available)
    if (ok.length > 0) {
      livres.push(...ok.map((x) => x.start))
      break
    }
  }
  if (livres.length === 0) return null

  const idx = [...new Set([0, Math.floor(livres.length / 2), livres.length - 1])].sort((a, b) => a - b)
  const escolhidos = idx.map((i) => livres[i])
  const amanha = new Date(new Date(`${hoje}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
  const porDia = new Map<string, Date[]>()
  for (const d of escolhidos) porDia.set(diaIso(d), [...(porDia.get(diaIso(d)) ?? []), d])
  const partes = [...porDia.entries()].map(([iso, ds]) => {
    const hs = ds.map(hora)
    const lista = hs.length > 1 ? `${hs.slice(0, -1).join(', ')} ou ${hs[hs.length - 1]}` : hs[0]
    return `${rotuloDia(iso, hoje, amanha)} às ${lista}`
  })
  return { slots: escolhidos.map(brt), texto: `Tenho ${partes.join(', ou ')}. Qual fica melhor pra você?` }
}

export type ResultadoAgendamento =
  | { ok: true; eventId: string; meetUrl: string; start: Date; dataFormatada: string }
  | { ok: false; motivo: 'indisponivel' | 'invalido' | 'erro'; detalhe: string }

export async function agendarReuniao(
  ctx: AgendaCtx,
  supabase: Supabase,
  p: { dataHora: string; email: string; nomeCompleto: string },
): Promise<ResultadoAgendamento> {
  try {
    if (!p.email.includes('@')) return { ok: false, motivo: 'invalido', detalhe: 'e-mail inválido' }
    if (p.nomeCompleto.trim().split(/\s+/).length < 2) return { ok: false, motivo: 'invalido', detalhe: 'falta sobrenome' }
    const start = parseBrazilDateTime(p.dataHora)
    if (isNaN(start.getTime())) return { ok: false, motivo: 'invalido', detalhe: 'data inválida' }
    const minutosAteInicio = (start.getTime() - Date.now()) / 60_000
    if (minutosAteInicio < MIN_NOTICE_MINUTES) return { ok: false, motivo: 'indisponivel', detalhe: 'já passou ou tem menos de 1 hora de folga' }
    if (minutosAteInicio > 60 * 24 * 60) return { ok: false, motivo: 'invalido', detalhe: 'mais de 60 dias no futuro' }

    const duracaoMin = await getMeetingDurationMinutes(ctx.companyId)
    const reconferencia = await checkAvailableSlots({ calendarId: ctx.calendarId, companyId: ctx.companyId, date: start, durationMinutes: duracaoMin })
    const slot = reconferencia.find((s) => Math.abs(s.start.getTime() - start.getTime()) < 60_000)
    if (!slot || !slot.available) return { ok: false, motivo: 'indisponivel', detalhe: 'fora do expediente ou já ocupado' }

    const janelaMs = 4 * 60 * 60_000
    const { data: possiveis } = await supabase
      .from('leads')
      .select('id, call_agendada_para')
      .eq('company_id', ctx.companyId)
      .eq('call_status', 'agendada')
      .neq('id', ctx.leadId)
      .not('call_agendada_para', 'is', null)
      .gte('call_agendada_para', new Date(start.getTime() - janelaMs).toISOString())
      .lte('call_agendada_para', new Date(start.getTime() + janelaMs).toISOString())
    const fim = start.getTime() + duracaoMin * 60_000
    const conflito = (possiveis ?? []).some((l) => {
      const ini = new Date(l.call_agendada_para as string).getTime()
      return ini < fim && ini + duracaoMin * 60_000 > start.getTime()
    })
    if (conflito) return { ok: false, motivo: 'indisponivel', detalhe: 'horário reservado no CRM para outro lead' }

    const titulo = ctx.eventTitleTemplate ? ctx.eventTitleTemplate.replace('{nome}', p.nomeCompleto) : `Call de venda : ${p.nomeCompleto}`
    const event = await createEventWithMeet({
      calendarId: ctx.calendarId,
      companyId: ctx.companyId,
      title: titulo,
      description: `Lead: ${p.nomeCompleto}\nWhatsApp: ${ctx.leadPhone}\nAgendado via Zaapply SDR`,
      start,
      durationMinutes: duracaoMin,
      attendeeEmail: p.email,
      attendeeName: p.nomeCompleto,
    })
    await supabase
      .from('leads')
      .update({
        contact_name: p.nomeCompleto,
        email: p.email,
        call_de_venda: true,
        call_agendada_para: event.start.toISOString(),
        meet_url: event.meetUrl,
        call_status: 'agendada',
        calendar_event_id: event.eventId,
      })
      .eq('id', ctx.leadId)
    return { ok: true, eventId: event.eventId, meetUrl: event.meetUrl, start: event.start, dataFormatada: formatDateTimeBR(event.start) }
  } catch (err: any) {
    console.error(`[SDR v3:${ctx.companyId}] agendarReuniao erro:`, err?.message)
    return { ok: false, motivo: 'erro', detalhe: err?.message ?? 'erro' }
  }
}
