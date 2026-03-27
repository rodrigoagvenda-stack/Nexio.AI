import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Users,
  Building2,
  Wallet,
  CalendarDays,
  ArrowRight,
  Church,
  Cake,
  Layers,
  Heart,
} from "lucide-react"
import Link from "next/link"

// Avatar color algorithm — same as escala-client.tsx
const AVATAR_COLORS = [
  "#1a4a2e", "#2d7a4f", "#1d4ed8", "#7c3aed",
  "#b45309", "#0f766e", "#9f1239", "#065f46",
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const DIAS_SEMANA_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const MESES_PT = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
]
const MESES_PT_CAP = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
]

function formatDateLong(date: Date): string {
  const dia = DIAS_SEMANA_PT[date.getDay()]
  const d = date.getDate()
  const mes = MESES_PT[date.getMonth()]
  const ano = date.getFullYear()
  return `${dia}, ${d} de ${mes} de ${ano}`
}

// Culto day-of-week coloring
function cultoDotColor(dateStr: string): { dot: string; badge: string; badgeText: string } {
  const dt = new Date(dateStr + "T12:00:00")
  const dow = dt.getDay()
  if (dow === 0) return { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", badgeText: "Dom" }
  if (dow === 3) return { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border border-blue-200", badgeText: "Qua" }
  if (dow === 5) return { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border border-amber-200", badgeText: "Sex" }
  return { dot: "bg-gray-400", badge: "bg-gray-50 text-gray-600 border border-gray-200", badgeText: DIAS_SEMANA_PT[dow].substring(0, 3) }
}

function diasAte(dateStr: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + "T00:00:00")
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "hoje"
  if (diff === 1) return "amanhã"
  return `em ${diff} dias`
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles").select("*").eq("id", user.id).single()
  if (!profile) return null

  const { data: igreja } = await (supabase as any)
    .from("igrejas").select("*").eq("id", profile.igreja_id || "").single()

  // Counts
  const { count: totalMembros } = await (supabase as any)
    .from("membros").select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id).eq("status", "ativo")

  const { count: totalEventos } = await (supabase as any)
    .from("eventos").select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id)
    .gte("data_inicio", new Date().toISOString().split("T")[0])

  const { count: totalMinisterios } = await (supabase as any)
    .from("ministerios").select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id).eq("ativo", true)

  // Saldo do mês — query lancamentos_financeiros for current month
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

  const { data: lancamentos } = await (supabase as any)
    .from("lancamentos_financeiros")
    .select("tipo, valor")
    .eq("igreja_id", profile.igreja_id)
    .gte("data", firstDayOfMonth)
    .lte("data", lastDayOfMonth)

  let saldoMes = 0
  if (lancamentos) {
    for (const l of lancamentos) {
      const valor = Number(l.valor) || 0
      if (l.tipo === "entrada") saldoMes += valor
      else if (l.tipo === "saida") saldoMes -= valor
    }
  }

  // Pedidos de oração ativos
  const { count: totalPedidosOracao } = await (supabase as any)
    .from("pedidos_oracao")
    .select("*", { count: "exact", head: true })
    .eq("status", "ativo")

  // Próximos eventos
  const { data: proximosEventos } = await (supabase as any)
    .from("eventos").select("*")
    .eq("igreja_id", profile.igreja_id)
    .gte("data_inicio", new Date().toISOString().split("T")[0])
    .order("data_inicio").limit(5)

  // Membros recentes
  const { data: membrosRecentes } = await (supabase as any)
    .from("membros").select("nome, data_entrada")
    .eq("igreja_id", profile.igreja_id)
    .order("created_at", { ascending: false }).limit(8)

  // Aniversariantes do mês — fetch all active members with data_nascimento and filter in JS
  const { data: todosMembros } = await (supabase as any)
    .from("membros")
    .select("id, nome, data_nascimento")
    .eq("igreja_id", profile.igreja_id)
    .eq("status", "ativo")
    .not("data_nascimento", "is", null)

  const mesAtual = now.getMonth()
  const aniversariantesMes: { id: string; nome: string; dia: number }[] = []
  if (todosMembros) {
    for (const m of todosMembros) {
      if (!m.data_nascimento) continue
      const dt = new Date(m.data_nascimento + "T12:00:00")
      if (dt.getMonth() === mesAtual) {
        aniversariantesMes.push({ id: m.id, nome: m.nome, dia: dt.getDate() })
      }
    }
    aniversariantesMes.sort((a, b) => a.dia - b.dia)
  }
  const aniversariantesExibir = aniversariantesMes.slice(0, 6)

  // Próximos cultos
  const today = new Date().toISOString().split("T")[0]
  const { data: proximosCultos } = await (supabase as any)
    .from("escalas_detalhes")
    .select("*, escalas!inner(igreja_id)")
    .eq("escalas.igreja_id", profile.igreja_id)
    .gte("data_culto", today)
    .order("data_culto")
    .limit(5)

  const firstName = profile.nome?.split(" ")[0] ?? "Pastor"
  const nomeIgreja = igreja?.nome || "Igreja Pentecostal Vale da Bênção"
  const dataHoje = formatDateLong(now)

  return (
    <div className="space-y-5">

      {/* ── Hero greeting card ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a4a2e 0%, #2d5a3d 60%, #1e6b43 100%)" }}
      >
        {/* subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative px-6 pt-6 pb-4">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-emerald-300 text-xs font-medium uppercase tracking-widest mb-1">
                {nomeIgreja}
              </p>
              <h1 className="text-white text-2xl font-bold leading-tight">
                Olá, {firstName} 👋
              </h1>
            </div>
            <div className="text-right mt-0.5">
              <p className="text-white/60 text-xs leading-relaxed">{dataHoje}</p>
            </div>
          </div>

          {/* Quick stat chips */}
          <div className="flex flex-wrap gap-2 mt-5 pb-1">
            {[
              { label: "membros", value: totalMembros ?? 0, href: "/membros" },
              { label: "eventos", value: totalEventos ?? 0, href: "/eventos" },
              { label: "ministérios", value: totalMinisterios ?? 0, href: "/ministerios" },
              { label: "pedidos oração", value: totalPedidosOracao ?? 0, href: "/pedidos-oracao" },
            ].map((chip) => (
              <Link key={chip.label} href={chip.href}>
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white/80 bg-white/10 hover:bg-white/20 border border-white/15 transition-colors cursor-pointer">
                  <span className="text-white font-bold">{chip.value}</span>
                  {chip.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Membros ativos */}
        <Link href="/membros">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer overflow-hidden group">
            <div className="border-l-4 border-emerald-500 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Membros ativos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalMembros ?? 0}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors">
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Saldo do mês */}
        <Link href="/financeiro">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer overflow-hidden group">
            <div className="border-l-4 border-blue-500 p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Saldo do mês</p>
                  <p className={`text-xl font-bold mt-1 truncate ${saldoMes >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {formatCurrency(saldoMes)}
                  </p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors shrink-0">
                  <Wallet className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Próximos eventos */}
        <Link href="/eventos">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer overflow-hidden group">
            <div className="border-l-4 border-amber-500 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Próx. eventos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalEventos ?? 0}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                  <CalendarDays className="h-4 w-4 text-amber-600" />
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Ministérios */}
        <Link href="/ministerios">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer overflow-hidden group">
            <div className="border-l-4 border-purple-500 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ministérios</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalMinisterios ?? 0}</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-purple-50 group-hover:bg-purple-100 flex items-center justify-center transition-colors">
                  <Layers className="h-4 w-4 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        </Link>

      </div>

      {/* ── Content grid: Cultos + Aniversariantes ── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Próximos Cultos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Church className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Próximos Cultos</p>
                <p className="text-xs text-gray-400">Escalas programadas</p>
              </div>
            </div>
            <Link href="/escalas">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors">
                Ver todos <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {proximosCultos && proximosCultos.length > 0 ? (
              proximosCultos.map((culto: any) => {
                const colors = cultoDotColor(culto.data_culto)
                const diffLabel = diasAte(culto.data_culto)
                const dtObj = new Date(culto.data_culto + "T12:00:00")
                const diaNum = dtObj.getDate()
                const mesStr = MESES_PT_CAP[dtObj.getMonth()].substring(0, 3)
                return (
                  <Link key={culto.id} href={`/escalas/${culto.escala_id ?? culto.id}`}>
                    <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      {/* Date block */}
                      <div className="flex flex-col items-center justify-center w-10 shrink-0">
                        <span className="text-xs font-bold text-gray-900 leading-none">{diaNum}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wide leading-none mt-0.5">{mesStr}</span>
                      </div>
                      {/* Dot */}
                      <div className={`h-2 w-2 rounded-full shrink-0 ${colors.dot}`} />
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {culto.tipo_culto || "Culto"}
                        </p>
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${colors.badge}`}>
                          {colors.badgeText}
                        </span>
                      </div>
                      {/* Days until */}
                      <span className={`text-xs font-medium shrink-0 ${diffLabel === "hoje" ? "text-emerald-600" : diffLabel === "amanhã" ? "text-amber-600" : "text-gray-400"}`}>
                        {diffLabel}
                      </span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="px-5 py-6 text-center">
                <Church className="h-6 w-6 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Nenhum culto programado</p>
                <Link href="/escalas/nova">
                  <span className="mt-2 inline-block text-xs text-emerald-600 font-medium hover:underline">Criar escala</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Aniversariantes do Mês */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-rose-50 flex items-center justify-center">
                <Cake className="h-3.5 w-3.5 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Aniversariantes</p>
                <p className="text-xs text-gray-400">
                  {MESES_PT_CAP[mesAtual]} · {aniversariantesMes.length} aniversariante{aniversariantesMes.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Link href="/membros">
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors">
                Ver membros <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>

          <div className="divide-y divide-gray-50">
            {aniversariantesExibir.length > 0 ? (
              <>
                {aniversariantesExibir.map((aniv) => {
                  const bg = avatarColor(aniv.nome)
                  const initials = getInitials(aniv.nome)
                  return (
                    <Link key={aniv.id} href={`/membros/${aniv.id}`}>
                      <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: bg }}
                        >
                          {initials}
                        </div>
                        <p className="flex-1 text-sm font-medium text-gray-900 truncate">{aniv.nome}</p>
                        <span className="text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5 shrink-0">
                          dia {aniv.dia}
                        </span>
                      </div>
                    </Link>
                  )
                })}
                {aniversariantesMes.length > 6 && (
                  <div className="px-5 py-2.5 text-center">
                    <p className="text-xs text-gray-400">+{aniversariantesMes.length - 6} outros este mês</p>
                  </div>
                )}
              </>
            ) : (
              <div className="px-5 py-6 text-center">
                <Cake className="h-6 w-6 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Nenhum aniversariante este mês</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Membros Recentes — horizontal scroll ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Membros Recentes</p>
              <p className="text-xs text-gray-400">Últimos cadastros</p>
            </div>
          </div>
          <Link href="/membros">
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors">
              Ver todos <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </div>

        {membrosRecentes && membrosRecentes.length > 0 ? (
          <div className="px-4 py-4 overflow-x-auto">
            <div className="flex gap-3" style={{ minWidth: "max-content" }}>
              {membrosRecentes.map((membro: any, i: number) => {
                const bg = avatarColor(membro.nome)
                const initials = getInitials(membro.nome)
                const dtEntrada = membro.data_entrada
                  ? new Date(membro.data_entrada + "T12:00:00")
                  : null
                const sinceLabel = dtEntrada
                  ? `desde ${MESES_PT_CAP[dtEntrada.getMonth()].substring(0, 3)}/${dtEntrada.getFullYear()}`
                  : "membro"
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 bg-gray-50 hover:bg-gray-100 transition-colors rounded-xl px-4 py-3 cursor-default"
                    style={{ minWidth: 96 }}
                  >
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: bg }}
                    >
                      {initials}
                    </div>
                    <p className="text-xs font-semibold text-gray-800 text-center leading-tight max-w-[80px] truncate">
                      {membro.nome.split(" ")[0]}
                    </p>
                    <span className="text-[10px] text-gray-400 text-center">{sinceLabel}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="px-5 py-6 text-center">
            <Users className="h-6 w-6 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Nenhum membro cadastrado</p>
            <Link href="/membros/novo">
              <span className="mt-2 inline-block text-xs text-emerald-600 font-medium hover:underline">Adicionar membro</span>
            </Link>
          </div>
        )}
      </div>

      {/* ── Pedidos de Oração + Quick actions row ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/pedidos-oracao">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-rose-200 transition-all cursor-pointer overflow-hidden group">
            <div className="border-l-4 border-rose-400 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pedidos de oração</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{totalPedidosOracao ?? 0}</p>
                  <p className="text-xs text-gray-400 mt-0.5">ativos</p>
                </div>
                <div className="h-9 w-9 rounded-lg bg-rose-50 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
                  <Heart className="h-4 w-4 text-rose-500" />
                </div>
              </div>
            </div>
          </div>
        </Link>

        {[
          { label: "Novo Membro",  href: "/membros/novo",   description: "Cadastrar membro" },
          { label: "Novo Evento",  href: "/eventos/novo",   description: "Agendar evento" },
          { label: "Nova Escala",  href: "/escalas/nova",   description: "Escala de culto" },
        ].map((action) => (
          <Link key={action.label} href={action.href}>
            <div className="bg-white rounded-xl border border-dashed border-gray-200 shadow-sm hover:shadow-md hover:border-emerald-300 hover:bg-emerald-50/30 transition-all cursor-pointer p-4 flex items-center gap-3 group">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center transition-colors shrink-0">
                <span className="text-emerald-600 text-lg font-light">+</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{action.label}</p>
                <p className="text-xs text-gray-400">{action.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
