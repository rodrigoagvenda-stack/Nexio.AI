/**
 * SDR v3: métricas semanais da spec (seção 1). Só leitura, sempre por company_id, mensagens com source = 'sdr'.
 * Compara a janela atual com a janela anterior de mesmo tamanho (v3 contra os 14 dias anteriores, a base já medida).
 */
import type { createServiceClient } from '@/lib/supabase/server'
import { getActiveConfig } from './config-store'
import { norm, sentencas } from './validator'

type Supabase = ReturnType<typeof createServiceClient>

const VALOR_RE = /R\$\s?\d|\d[\d.,]*\s*reais\b|\bmil\s+reais\b/i
const AGENDAMENTO_RE = /\b(vou\s+agendar|j[aá]\s+agendei|agendei|(?:est[aá]|t[aá]|ficou|fica)\s+(?:agendad[oa]|marcad[oa])|reuni[aã]o\s+(?:est[aá]\s+)?confirmada|te\s+mando\s+o\s+link)\b/i
const RAJADA_MS = 90_000

export interface MetricasJanela {
  desde: string
  ate: string
  mensagens_sdr: number
  conversas_com_sdr: number
  valor_em_reais_pelo_sdr: number
  palavra_proibida_qualquer_source: number
  mensagens_com_2_ou_mais_perguntas: number
  rajadas_com_perguntas_em_blocos_diferentes: number
  frases_repetidas_na_conversa: number
  pergunta_de_qualificacao_feita_2x: number
  abertura_respondida: { aberturas: number; respondidas: number }
  agendamento_prometido_sem_evento: number
  agendamentos_criados: number
  lead_respondeu_e_ficou_sem_resposta_em_pausa: number
}

export interface MetricasV3 {
  turnos: { motor: string; turnos: number; regenerou: number; escalou: number; latencia_media_ms: number | null; tokens_medios: number | null }[]
  violacoes_v3: Record<string, { bloqueia: number; registro: number }>
}

const tokens = (t: string) => norm(t).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
const jaccard = (a: string[], b: string[]) => {
  const sa = new Set(a)
  const sb = new Set(b)
  let i = 0
  for (const t of sa) if (sb.has(t)) i++
  return sa.size + sb.size === 0 ? 0 : i / (sa.size + sb.size - i)
}

async function todas<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await q(from, from + 999)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function metricasJanela(supabase: Supabase, companyId: number, desde: Date, ate: Date): Promise<MetricasJanela> {
  const cfg = (await getActiveConfig(companyId, supabase))?.config
  const proibidas = (cfg?.palavras_proibidas ?? ['gratuito', 'gratuita', 'grátis', 'gratis', 'sem custo']).map(norm)
  const perguntasCfg = (cfg?.qualificacao.perguntas ?? []).map((q) => ({ id: q.id, sents: sentencas(q.texto).filter((s) => s.includes('?')).map(tokens) }))

  const msgs = await todas<{ id_da_conversacao: string; texto_da_mensagem: string | null; direcao: string; source: string | null; carimbo_de_data_e_hora: string }>((from, to) =>
    supabase
      .from('mensagens_do_whatsapp')
      .select('id_da_conversacao, texto_da_mensagem, direcao, source, carimbo_de_data_e_hora')
      .eq('company_id', companyId)
      .gte('carimbo_de_data_e_hora', desde.toISOString())
      .lt('carimbo_de_data_e_hora', ate.toISOString())
      .order('carimbo_de_data_e_hora', { ascending: true })
      .range(from, to),
  )

  const porConv = new Map<string, typeof msgs>()
  for (const m of msgs) porConv.set(m.id_da_conversacao, [...(porConv.get(m.id_da_conversacao) ?? []), m])

  const r: MetricasJanela = {
    desde: desde.toISOString(),
    ate: ate.toISOString(),
    mensagens_sdr: 0,
    conversas_com_sdr: 0,
    valor_em_reais_pelo_sdr: 0,
    palavra_proibida_qualquer_source: 0,
    mensagens_com_2_ou_mais_perguntas: 0,
    rajadas_com_perguntas_em_blocos_diferentes: 0,
    frases_repetidas_na_conversa: 0,
    pergunta_de_qualificacao_feita_2x: 0,
    abertura_respondida: { aberturas: 0, respondidas: 0 },
    agendamento_prometido_sem_evento: 0,
    agendamentos_criados: 0,
    lead_respondeu_e_ficou_sem_resposta_em_pausa: 0,
  }

  const convsComPromessa: string[] = []
  for (const [conv, lista] of porConv) {
    const out = lista.filter((m) => m.direcao === 'outbound')
    const sdr = out.filter((m) => m.source === 'sdr')
    if (sdr.length > 0) r.conversas_com_sdr++
    r.mensagens_sdr += sdr.length

    for (const m of out) {
      const t = norm(m.texto_da_mensagem ?? '')
      if (proibidas.some((w) => w && t.includes(w))) r.palavra_proibida_qualquer_source++
    }

    const vistas = new Set<string>()
    const contagemPerg = new Map<string, number>()
    let rajada: typeof sdr = []
    const fecharRajada = () => {
      if (rajada.filter((m) => (m.texto_da_mensagem ?? '').includes('?')).length > 1) r.rajadas_com_perguntas_em_blocos_diferentes++
      rajada = []
    }
    for (const m of sdr) {
      const texto = m.texto_da_mensagem ?? ''
      if (VALOR_RE.test(texto)) r.valor_em_reais_pelo_sdr++
      if ((texto.match(/\?/g) ?? []).length >= 2) r.mensagens_com_2_ou_mais_perguntas++
      if (AGENDAMENTO_RE.test(texto)) convsComPromessa.push(conv)
      const ult = rajada[rajada.length - 1]
      if (ult && new Date(m.carimbo_de_data_e_hora).getTime() - new Date(ult.carimbo_de_data_e_hora).getTime() > RAJADA_MS) fecharRajada()
      rajada.push(m)
      for (const s of sentencas(texto)) {
        const n = norm(s)
        if (tokens(s).length < 4) continue
        if (vistas.has(n)) r.frases_repetidas_na_conversa++
        vistas.add(n)
        if (s.includes('?')) {
          const ts = tokens(s)
          for (const q of perguntasCfg) {
            if (q.sents.some((tq) => tq.length >= 3 && jaccard(ts, tq) >= 0.6)) contagemPerg.set(q.id, (contagemPerg.get(q.id) ?? 0) + 1)
          }
        }
      }
    }
    fecharRajada()
    for (const n of contagemPerg.values()) if (n >= 2) r.pergunta_de_qualificacao_feita_2x++

    const primeira = out[0]
    if (primeira) {
      r.abertura_respondida.aberturas++
      const t0 = new Date(primeira.carimbo_de_data_e_hora).getTime()
      if (lista.some((m) => m.direcao === 'inbound' && new Date(m.carimbo_de_data_e_hora).getTime() > t0)) r.abertura_respondida.respondidas++
    }
  }

  // Promessa de agendamento: conta a conversa cujo lead não tem evento criado
  if (convsComPromessa.length > 0) {
    const unicas = [...new Set(convsComPromessa)]
    const { data: convs } = await supabase.from('conversas_do_whatsapp').select('id, id_do_lead').eq('company_id', companyId).in('id', unicas.slice(0, 500))
    const leadIds = (convs ?? []).map((c: any) => c.id_do_lead).filter(Boolean)
    const { data: leads } = leadIds.length ? await supabase.from('leads').select('id, calendar_event_id').eq('company_id', companyId).in('id', leadIds) : { data: [] as any[] }
    const semEvento = new Set((leads ?? []).filter((l: any) => !l.calendar_event_id).map((l: any) => l.id))
    r.agendamento_prometido_sem_evento = (convs ?? []).filter((c: any) => semEvento.has(c.id_do_lead)).length
  }

  const { count: agend } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('call_status', 'agendada')
    .not('calendar_event_id', 'is', null)
    .gte('updated_at', desde.toISOString())
    .lt('updated_at', ate.toISOString())
  r.agendamentos_criados = agend ?? 0

  // Lead respondeu e a conversa está pausada com a última mensagem dele há mais de 1h
  const { data: pausadas } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', companyId)
    .eq('agente_pausado', true)
  for (const c of (pausadas ?? []).slice(0, 300)) {
    const { data: ult } = await supabase
      .from('mensagens_do_whatsapp')
      .select('direcao, carimbo_de_data_e_hora')
      .eq('id_da_conversacao', c.id)
      .order('carimbo_de_data_e_hora', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ult?.direcao === 'inbound' && Date.now() - new Date(ult.carimbo_de_data_e_hora).getTime() > 3_600_000) r.lead_respondeu_e_ficou_sem_resposta_em_pausa++
  }
  return r
}

export async function metricasTurnos(supabase: Supabase, companyId: number, desde: Date, ate: Date): Promise<MetricasV3> {
  const rows = await todas<{ engine: string; acao: any; regenerou: boolean; latencia_ms: number | null; tokens: number | null; validador_violacoes: any }>((from, to) =>
    supabase
      .from('sdr_turn_log')
      .select('engine, acao, regenerou, latencia_ms, tokens, validador_violacoes')
      .eq('company_id', companyId)
      .gte('created_at', desde.toISOString())
      .lt('created_at', ate.toISOString())
      .range(from, to),
  )
  const por = new Map<string, typeof rows>()
  for (const t of rows) por.set(t.engine, [...(por.get(t.engine) ?? []), t])
  const media = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => typeof x === 'number')
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  }
  const violacoes: MetricasV3['violacoes_v3'] = {}
  for (const t of por.get('v3') ?? []) {
    for (const v of (Array.isArray(t.validador_violacoes) ? t.validador_violacoes : []) as { regra: string; modo: 'bloqueia' | 'registro' }[]) {
      violacoes[v.regra] ??= { bloqueia: 0, registro: 0 }
      violacoes[v.regra][v.modo]++
    }
  }
  return {
    turnos: [...por.entries()].map(([motor, ts]) => ({
      motor,
      turnos: ts.length,
      regenerou: ts.filter((t) => t.regenerou).length,
      escalou: ts.filter((t) => typeof t.acao?.tipo === 'string' && t.acao.tipo.startsWith('escalar')).length,
      latencia_media_ms: media(ts.map((t) => t.latencia_ms)),
      tokens_medios: media(ts.map((t) => t.tokens)),
    })),
    violacoes_v3: violacoes,
  }
}

export async function relatorioSemanal(supabase: Supabase, companyId: number, dias = 14) {
  const fim = new Date()
  const meio = new Date(fim.getTime() - dias * 86_400_000)
  const ini = new Date(meio.getTime() - dias * 86_400_000)
  const [atual, anterior, turnos] = await Promise.all([
    metricasJanela(supabase, companyId, meio, fim),
    metricasJanela(supabase, companyId, ini, meio),
    metricasTurnos(supabase, companyId, meio, fim),
  ])
  return { dias, atual, anterior, turnos }
}
