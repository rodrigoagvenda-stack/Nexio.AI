import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import {
  Users,
  Wallet,
  CalendarDays,
  ArrowRight,
  Church,
  Cake,
  Layers,
  Heart,
  Plus,
} from "lucide-react"
import Link from "next/link"

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

const DIAS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
const MESES_PT = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]
const MESES_CAP = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

function diasAte(dateStr: string): { label: string; color: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + "T00:00:00")
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return { label: "hoje", color: "text-primary" }
  if (diff === 1) return { label: "amanhã", color: "text-amber-600" }
  return { label: `em ${diff}d`, color: "text-muted-foreground" }
}

function cultoBadge(dateStr: string) {
  const dow = new Date(dateStr + "T12:00:00").getDay()
  if (dow === 0) return { bg: "bg-emerald-500/10 text-emerald-600", label: "Dom" }
  if (dow === 3) return { bg: "bg-blue-500/10 text-blue-600", label: "Qua" }
  if (dow === 5) return { bg: "bg-amber-500/10 text-amber-600", label: "Sex" }
  return { bg: "bg-muted text-muted-foreground", label: DIAS_PT[dow].substring(0, 3) }
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles").select("*").eq("id", user.id).single()
  if (!profile) return null

  const { data: igreja } = await (supabase as any)
    .from("igrejas").select("nome").eq("id", profile.igreja_id || "").single()

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

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

  const { data: lancamentos } = await (supabase as any)
    .from("lancamentos_financeiros").select("tipo, valor")
    .eq("igreja_id", profile.igreja_id)
    .gte("data", firstDay).lte("data", lastDay)

  let saldoMes = 0
  for (const l of lancamentos ?? []) {
    const v = Number(l.valor) || 0
    if (l.tipo === "entrada") saldoMes += v
    else if (l.tipo === "saida") saldoMes -= v
  }

  const { count: totalPedidos } = await (supabase as any)
    .from("pedidos_oracao").select("*", { count: "exact", head: true })
    .eq("status", "ativo")

  const today = new Date().toISOString().split("T")[0]

  const { data: proximosCultos } = await (supabase as any)
    .from("escalas_detalhes").select("*, escalas!inner(igreja_id)")
    .eq("escalas.igreja_id", profile.igreja_id)
    .gte("data_culto", today).order("data_culto").limit(5)

  const { data: todosMembros } = await (supabase as any)
    .from("membros").select("id, nome, data_nascimento")
    .eq("igreja_id", profile.igreja_id).eq("status", "ativo")
    .not("data_nascimento", "is", null)

  const mesAtual = now.getMonth()
  const aniversariantes = (todosMembros ?? [])
    .filter((m: any) => new Date(m.data_nascimento + "T12:00:00").getMonth() === mesAtual)
    .map((m: any) => ({ ...m, dia: new Date(m.data_nascimento + "T12:00:00").getDate() }))
    .sort((a: any, b: any) => a.dia - b.dia)
    .slice(0, 6)

  const { data: membrosRecentes } = await (supabase as any)
    .from("membros").select("nome, data_entrada")
    .eq("igreja_id", profile.igreja_id)
    .order("created_at", { ascending: false }).limit(8)

  const firstName = profile.nome?.split(" ")[0] ?? "Pastor"
  const nomeIgreja = igreja?.nome || "IPVB"
  const dataHoje = `${DIAS_PT[now.getDay()]}, ${now.getDate()} de ${MESES_PT[now.getMonth()]}`

  const stats = [
    { label: "Membros ativos", value: totalMembros ?? 0, icon: Users,       href: "/membros",         color: "text-primary"   },
    { label: "Saldo do mês",   value: formatCurrency(saldoMes), icon: Wallet,      href: "/financeiro",      color: saldoMes >= 0 ? "text-foreground" : "text-destructive" },
    { label: "Próx. eventos",  value: totalEventos ?? 0, icon: CalendarDays, href: "/eventos",         color: "text-foreground" },
    { label: "Ministérios",    value: totalMinisterios ?? 0, icon: Layers,    href: "/ministerios",     color: "text-foreground" },
  ]

  return (
    <div className="space-y-6">

      {/* Greeting */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1">{nomeIgreja}</p>
          <h1 className="text-2xl font-bold tracking-tight">Olá, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dataHoje}</p>
        </div>
        <Link href="/escalas/nova">
          <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" />
            Nova Escala
          </span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <p className={`text-2xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Cultos + Aniversariantes */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Próximos Cultos */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Church className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Próximos Cultos</span>
            </div>
            <Link href="/escalas">
              <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                Ver todos <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {proximosCultos && proximosCultos.length > 0 ? proximosCultos.map((c: any) => {
              const dt = new Date(c.data_culto + "T12:00:00")
              const { label, color } = diasAte(c.data_culto)
              const badge = cultoBadge(c.data_culto)
              return (
                <Link key={c.id} href={`/escalas/${c.escala_id ?? c.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                    <div className="text-center w-9 shrink-0">
                      <div className="text-sm font-bold leading-none">{dt.getDate()}</div>
                      <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{MESES_CAP[dt.getMonth()].substring(0,3)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.tipo_culto || "Culto"}</p>
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${badge.bg}`}>{badge.label}</span>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${color}`}>{label}</span>
                  </div>
                </Link>
              )
            }) : (
              <div className="px-4 py-8 text-center">
                <Church className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum culto programado</p>
                <Link href="/escalas/nova">
                  <span className="mt-2 inline-block text-xs text-primary hover:underline">Criar escala</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Aniversariantes */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Cake className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-semibold">Aniversariantes</span>
              <span className="text-xs text-muted-foreground">· {MESES_CAP[mesAtual]}</span>
            </div>
            <Link href="/membros">
              <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                Membros <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {aniversariantes.length > 0 ? aniversariantes.map((a: any) => (
              <Link key={a.id} href={`/membros/${a.id}`}>
                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors">
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                    style={{ backgroundColor: avatarColor(a.nome) }}
                  >
                    {getInitials(a.nome)}
                  </div>
                  <p className="flex-1 text-sm truncate">{a.nome}</p>
                  <span className="text-xs font-semibold text-rose-500 shrink-0">dia {a.dia}</span>
                </div>
              </Link>
            )) : (
              <div className="px-4 py-8 text-center">
                <Cake className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum aniversariante este mês</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Quick actions + Pedidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/pedidos-oracao">
          <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground">Pedidos oração</p>
              <Heart className="h-4 w-4 text-muted-foreground group-hover:text-rose-500 transition-colors" />
            </div>
            <p className="text-2xl font-bold">{totalPedidos ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ativos</p>
          </div>
        </Link>

        {[
          { label: "Novo Membro",  href: "/membros/novo" },
          { label: "Novo Evento",  href: "/eventos/novo" },
          { label: "Novo Pedido",  href: "/pedidos-oracao/novo" },
        ].map((a) => (
          <Link key={a.label} href={a.href}>
            <div className="bg-card border border-dashed border-border rounded-lg p-4 hover:border-primary/50 hover:bg-muted/30 transition-all group h-full flex flex-col justify-center">
              <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-medium">{a.label}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
