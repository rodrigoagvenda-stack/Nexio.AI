import { createClient } from "@/lib/supabase/server"
import { formatCurrency } from "@/lib/utils"
import {
  Users, Wallet, CalendarDays, Layers, Church,
  Cake, Heart, Plus, ArrowRight, TrendingUp,
} from "lucide-react"
import Link from "next/link"

const AVATAR_COLORS = [
  "#8a8345","#C1BC7A","#1d4ed8","#7c3aed","#b45309","#0f766e","#9f1239","#a8a35e",
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string) {
  const p = name.trim().split(" ").filter(Boolean)
  return p.length === 1 ? p[0].substring(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

const DIAS   = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]
const MESES  = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

function diasAte(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const diff  = Math.round((new Date(dateStr + "T00:00:00").getTime() - today.getTime()) / 86400000)
  if (diff === 0) return { label: "Hoje",    cls: "bg-primary/10 text-primary" }
  if (diff === 1) return { label: "Amanhã",  cls: "bg-amber-500/10 text-amber-600" }
  return           { label: `${diff}d`,      cls: "bg-muted text-muted-foreground" }
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

  const { count: totalPedidos } = await (supabase as any)
    .from("pedidos_oracao").select("*", { count: "exact", head: true })
    .eq("status", "ativo")

  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]

  const { data: lancamentos } = await (supabase as any)
    .from("lancamentos_financeiros").select("tipo, valor")
    .eq("igreja_id", profile.igreja_id)
    .gte("data", firstDay).lte("data", lastDay)

  let entradas = 0, saidas = 0
  for (const l of lancamentos ?? []) {
    const v = Number(l.valor) || 0
    if (l.tipo === "entrada") entradas += v
    else if (l.tipo === "saida") saidas += v
  }
  const saldo = entradas - saidas

  const today = new Date().toISOString().split("T")[0]
  const { data: proximosCultos } = await (supabase as any)
    .from("escalas_detalhes").select("*, escalas!inner(igreja_id)")
    .eq("escalas.igreja_id", profile.igreja_id)
    .gte("data_culto", today).order("data_culto").limit(5)

  const { data: todosMembros } = await (supabase as any)
    .from("membros").select("id, nome, data_nascimento")
    .eq("igreja_id", profile.igreja_id).eq("status", "ativo")
    .not("data_nascimento", "is", null)

  const aniversariantes = (todosMembros ?? [])
    .filter((m: any) => new Date(m.data_nascimento + "T12:00:00").getMonth() === now.getMonth())
    .map((m: any) => ({ ...m, dia: new Date(m.data_nascimento + "T12:00:00").getDate() }))
    .sort((a: any, b: any) => a.dia - b.dia)
    .slice(0, 5)

  const firstName  = profile.nome?.split(" ")[0] ?? "Pastor"
  const nomeIgreja = igreja?.nome || "IPVB"
  const dataHoje   = `${DIAS[now.getDay()]}, ${now.getDate()} de ${MESES_FULL[now.getMonth()].toLowerCase()} de ${now.getFullYear()}`

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{dataHoje}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:block">{nomeIgreja}</span>
          <Link href="/escalas/nova">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Nova Escala
            </span>
          </Link>
        </div>
      </div>

      {/* Stat cards — 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Membros */}
        <Link href="/membros">
          <div className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-[#C1BC7A]/10 text-[#8a8345]">
                <TrendingUp className="h-2.5 w-2.5" /> ativos
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight">{totalMembros ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Membros ativos</p>
          </div>
        </Link>

        {/* Saldo */}
        <Link href="/financeiro">
          <div className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${saldo >= 0 ? "bg-[#C1BC7A]/10 text-[#8a8345]" : "bg-destructive/10 text-destructive"}`}>
                {saldo >= 0 ? "+" : ""}{saldo >= 0 ? formatCurrency(entradas) : formatCurrency(saidas)}
              </span>
            </div>
            <p className={`text-2xl font-bold tracking-tight ${saldo < 0 ? "text-destructive" : ""}`}>
              {formatCurrency(saldo)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Saldo · {MESES_FULL[now.getMonth()]}</p>
          </div>
        </Link>

        {/* Eventos */}
        <Link href="/eventos">
          <div className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <CalendarDays className="h-5 w-5 text-amber-600" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">{totalEventos ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Próximos eventos</p>
          </div>
        </Link>

        {/* Ministérios */}
        <Link href="/ministerios">
          <div className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <Layers className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="text-3xl font-bold tracking-tight">{totalMinisterios ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Ministérios ativos</p>
          </div>
        </Link>

      </div>

      {/* Lists row */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Próximos Cultos */}
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Próximos Cultos</p>
              <p className="text-xs text-muted-foreground">Escalas programadas</p>
            </div>
            <Link href="/escalas">
              <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                Ver todos <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="border-t border-border divide-y divide-border">
            {proximosCultos && proximosCultos.length > 0 ? proximosCultos.map((c: any) => {
              const dt   = new Date(c.data_culto + "T12:00:00")
              const diff = diasAte(c.data_culto)
              return (
                <Link key={c.id} href={`/escalas/${c.escala_id ?? c.id}`}>
                  <div className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="h-9 w-9 rounded-xl bg-muted flex flex-col items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold leading-none">{dt.getDate()}</span>
                      <span className="text-[9px] text-muted-foreground uppercase mt-0.5">{MESES[dt.getMonth()]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.tipo_culto || "Culto"}</p>
                      <p className="text-xs text-muted-foreground">{DIAS[dt.getDay()]}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${diff.cls}`}>
                      {diff.label}
                    </span>
                  </div>
                </Link>
              )
            }) : (
              <div className="px-5 py-8 text-center">
                <Church className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum culto programado</p>
              </div>
            )}
          </div>
        </div>

        {/* Aniversariantes */}
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Aniversariantes</p>
              <p className="text-xs text-muted-foreground">{MESES_FULL[now.getMonth()]}</p>
            </div>
            <Link href="/membros">
              <span className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                Ver membros <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
          <div className="border-t border-border divide-y divide-border">
            {aniversariantes.length > 0 ? aniversariantes.map((a: any) => (
              <Link key={a.id} href={`/membros/${a.id}`}>
                <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: avatarColor(a.nome) }}
                  >
                    {initials(a.nome)}
                  </div>
                  <p className="flex-1 text-sm truncate">{a.nome}</p>
                  <span className="text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-full px-2 py-0.5 shrink-0">
                    dia {a.dia}
                  </span>
                </div>
              </Link>
            )) : (
              <div className="px-5 py-8 text-center">
                <Cake className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum aniversariante este mês</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom: Pedidos + Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

        <Link href="/pedidos-oracao">
          <div className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                <Heart className="h-5 w-5 text-rose-500" />
              </div>
            </div>
            <p className="text-3xl font-bold">{totalPedidos ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Pedidos de oração</p>
          </div>
        </Link>

        {[
          { label: "Novo Membro",  sub: "Cadastrar", href: "/membros/novo" },
          { label: "Novo Evento",  sub: "Agendar",   href: "/eventos/novo" },
          { label: "Novo Pedido",  sub: "Oração",    href: "/pedidos-oracao/novo" },
        ].map((a) => (
          <Link key={a.label} href={a.href}>
            <div className="bg-card rounded-2xl p-5 shadow-sm hover:shadow-md border border-dashed border-border hover:border-primary/30 transition-all group h-full flex flex-col">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{a.sub}</p>
            </div>
          </Link>
        ))}
      </div>

    </div>
  )
}
