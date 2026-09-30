/**
 * SDR v3: agendamento chamado pelo código, sem sub-agente (spec seção 2).
 * Mesmas travas do Agendar_gcal atual: folga mínima, no máximo 60 dias, reconferência do slot,
 * conflito com outro lead no CRM, e o CRM só é gravado depois de o evento existir.
 */
import type { createServiceClient } from '@/lib/supabase/server'
import { MIN_NOTICE_MINUTES } from '@/lib/slot-notice'
import { cancelEvent, checkAvailableSlots, createEventWithMeet, formatDateTimeBR, getMeetingDurationMinutes, parseBrazilDateTime } from '@/lib/google-calendar'

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

export type Periodo = 'manha' | 'tarde' | 'noite'
export interface FiltroHorario {
  periodos: Periodo[]
  depoisDe?: number
  antesDe?: number
  evitarHoje?: boolean
  evitarAmanha?: boolean
}

const semAcento = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const periodoDe = (h: number): Periodo => (h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite')

/** Lê o que o lead disse de disponibilidade ("de manhã não dá", "só à tarde", "depois das 18h", "hoje não")
 * e devolve o filtro dos horários a oferecer. Sem restrição reconhecida devolve null (oferta normal). */
export function filtroDisponibilidade(texto: string | undefined | null): FiltroHorario | null {
  if (!texto?.trim()) return null
  const t = semAcento(texto)
  const P = '(manha|tarde|noite)'
  const todos: Periodo[] = ['manha', 'tarde', 'noite']
  const nao = new Set<Periodo>()
  const so = new Set<Periodo>()
  for (const m of t.matchAll(new RegExp(`${P}[^.,;]{0,25}?\\b(nao|n|ruim|complicad\\w*|impossivel|nem pensar)\\b`, 'g'))) nao.add(m[1] as Periodo)
  for (const m of t.matchAll(new RegExp(`\\b(nao|n)\\s+(da|posso|consigo|rola|tenho como|vai dar)\\b[^.,;]{0,20}?\\b${P}`, 'g'))) nao.add(m[3] as Periodo)
  for (const m of t.matchAll(new RegExp(`\\b(so|somente|apenas|prefiro|melhor|pode ser)\\s+(de |a |pela |na |no )?${P}`, 'g'))) so.add(m[3] as Periodo)
  const f: FiltroHorario = { periodos: so.size ? [...so] : todos.filter((p) => !nao.has(p)) }
  const depois = t.match(/depois d[ao]s?\s+(\d{1,2})\s*(h|:|horas?)?/)
  const antes = t.match(/antes d[ao]s?\s+(\d{1,2})\s*(h|:|horas?)?/)
  if (depois) f.depoisDe = Number(depois[1])
  if (antes) f.antesDe = Number(antes[1])
  if (/\bhoje\b[^.,;]{0,15}\b(nao|n)\b|\b(nao|n)\s+(da|posso|consigo)\s+hoje\b/.test(t)) f.evitarHoje = true
  if (/\bamanha\b[^.,;]{0,15}\b(nao|n)\b|\b(nao|n)\s+(da|posso|consigo)\s+amanha\b/.test(t)) f.evitarAmanha = true
  const restringe = f.periodos.length < 3 || f.depoisDe !== undefined || f.antesDe !== undefined || f.evitarHoje || f.evitarAmanha
  if (f.periodos.length === 0) return null
  return restringe ? f : null
}

/** Horário (Brasília) passa no filtro do lead? */
export function passaFiltro(d: Date, f: FiltroHorario | null, hojeIso: string, amanhaIso: string): boolean {
  if (!f) return true
  const [h, m] = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).split(':').map(Number)
  const dia = diaIso(d)
  if (f.evitarHoje && dia === hojeIso) return false
  if (f.evitarAmanha && dia === amanhaIso) return false
  if (!f.periodos.includes(periodoDe(h))) return false
  if (f.depoisDe !== undefined && h < f.depoisDe) return false
  if (f.antesDe !== undefined && (h > f.antesDe || (h === f.antesDe && m > 0))) return false
  return true
}

/** Até 3 horários livres (hoje com folga de 1h e o próximo dia útil com vaga), espalhados.
 * filtro: restrição que o lead deu ("manhã não dá"). jaOfertados: nunca repete a mesma oferta se houver outra opção. */
export async function ofertarHorarios(ctx: AgendaCtx, opts: { filtro?: FiltroHorario | null; jaOfertados?: string[] } = {}): Promise<Oferta | null> {
  const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
  const amanhaIso = new Date(new Date(`${hoje}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
  const ja = new Set(opts.jaOfertados ?? [])
  const ok = (d: Date) => passaFiltro(d, opts.filtro ?? null, hoje, amanhaIso)
  const todos: Date[] = []
  const slotsHoje = await checkAvailableSlots({ calendarId: ctx.calendarId, date: new Date(hoje), companyId: ctx.companyId })
  todos.push(...slotsHoje.filter((s) => s.available && ok(s.start)).map((s) => s.start))
  const limiteDias = opts.filtro ? 14 : 7
  for (let i = 1; i <= limiteDias; i++) {
    const dia = new Date(new Date(`${hoje}T12:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10)
    const s = await checkAvailableSlots({ calendarId: ctx.calendarId, date: new Date(`${dia}T12:00:00Z`), companyId: ctx.companyId })
    const bons = s.filter((x) => x.available && ok(x.start))
    if (bons.length > 0) {
      todos.push(...bons.map((x) => x.start))
      if (todos.filter((d) => !ja.has(brt(d))).length >= 3) break
    }
  }
  const novos = todos.filter((d) => !ja.has(brt(d)))
  const livres = novos.length > 0 ? novos : todos
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
  /** eventoParaCancelar: id do evento antigo no Calendar quando isso é uma REMARCAÇÃO (lead já tinha reunião marcada).
   * Nunca cancela antes de criar a nova: se cancelasse primeiro e a criação falhasse, o lead ficaria sem reunião nenhuma. */
  p: { dataHora: string; email: string; nomeCompleto: string; eventoParaCancelar?: string },
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
    if (p.eventoParaCancelar) {
      try {
        await cancelEvent(ctx.calendarId, p.eventoParaCancelar, ctx.companyId)
      } catch (err: any) {
        // A reunião nova já existe (o que importa pro lead); só registra que o evento velho ficou órfão no Calendar.
        console.error(`[SDR v3:${ctx.companyId}] cancelar evento antigo (remarcação) falhou, evento novo criado normalmente:`, err?.message)
      }
    }
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

export type ResultadoCancelamento = { ok: true } | { ok: false; detalhe: string }

/** Cancela de verdade (evento real no Calendar, não só a conversa): mesma ação do "Deletar_gcal" do motor
 * antigo. O v3 nunca teve isso (achado real, lead Rodrigo Evangelista/63104, 28/09/2026: pediu pra cancelar
 * 3 vezes, o motor tratou como objeção de venda e encerrou a conversa sem cancelar nada — o evento ficou
 * órfão no Calendar real do Bruno). */
export async function cancelarReuniao(ctx: AgendaCtx, supabase: Supabase, eventId: string): Promise<ResultadoCancelamento> {
  try {
    await cancelEvent(ctx.calendarId, eventId, ctx.companyId)
    await supabase
      .from('leads')
      .update({ call_de_venda: false, call_status: 'cancelada', calendar_event_id: null, meet_url: null, call_agendada_para: null })
      .eq('id', ctx.leadId)
    return { ok: true }
  } catch (err: any) {
    console.error(`[SDR v3:${ctx.companyId}] cancelarReuniao erro:`, err?.message)
    return { ok: false, detalhe: err?.message ?? 'erro' }
  }
}
