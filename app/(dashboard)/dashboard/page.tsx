import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Users,
  Building2,
  Wallet,
  Calendar,
  UserCheck,
  CalendarDays,
  ArrowRight,
  Church,
  Heart,
  Cake,
} from "lucide-react"
import Link from "next/link"

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
    .order("created_at", { ascending: false }).limit(5)

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
  const aniversariantesExibir = aniversariantesMes.slice(0, 5)

  // Próximos cultos
  const today = new Date().toISOString().split("T")[0]
  const { data: proximosCultos } = await (supabase as any)
    .from("escalas_detalhes")
    .select("*, escalas!inner(igreja_id)")
    .eq("escalas.igreja_id", profile.igreja_id)
    .gte("data_culto", today)
    .order("data_culto")
    .limit(5)

  const stats = [
    { label: "Membros ativos",    value: totalMembros ?? 0,           icon: Users,       href: "/membros" },
    { label: "Próximos eventos",  value: totalEventos ?? 0,           icon: CalendarDays, href: "/eventos" },
    { label: "Ministérios",       value: totalMinisterios ?? 0,       icon: Building2,   href: "/ministerios" },
    { label: "Saldo do mês",      value: formatCurrency(saldoMes),    icon: Wallet,      href: "/financeiro" },
    { label: "Pedidos ativos",    value: totalPedidosOracao ?? 0,     icon: Heart,       href: "/pedidos-oracao" },
  ]

  const mesesPt = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Olá, {profile.nome?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {igreja?.nome || "Igreja Pentecostal Vale da Bênção"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:border-primary/40 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Content grid — row 1: Próximos Eventos + Membros Recentes */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próximos Eventos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-sm font-semibold">Próximos Eventos</CardTitle>
              <CardDescription className="text-xs mt-0.5">Programados para os próximos dias</CardDescription>
            </div>
            <Link href="/eventos">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {proximosEventos?.length > 0 ? (
              <div className="space-y-2">
                {proximosEventos.map((evento: any) => (
                  <Link key={evento.id} href={`/eventos/${evento.id}`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{evento.nome}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(evento.data_inicio)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum evento programado</p>
                <Link href="/eventos/novo">
                  <Button variant="outline" size="sm" className="mt-3 h-8 text-xs">
                    Criar evento
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Membros Recentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-sm font-semibold">Membros Recentes</CardTitle>
              <CardDescription className="text-xs mt-0.5">Últimos cadastros</CardDescription>
            </div>
            <Link href="/membros">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {membrosRecentes?.length > 0 ? (
              <div className="space-y-2">
                {membrosRecentes.map((membro: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      {membro.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{membro.nome}</p>
                      <p className="text-xs text-muted-foreground">desde {formatDate(membro.data_entrada)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum membro cadastrado</p>
                <Link href="/membros/novo">
                  <Button variant="outline" size="sm" className="mt-3 h-8 text-xs">
                    Adicionar membro
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content grid — row 2: Aniversariantes + Próximos Cultos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aniversariantes do mês */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-sm font-semibold">Aniversariantes do Mês</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {mesesPt[mesAtual].charAt(0).toUpperCase() + mesesPt[mesAtual].slice(1)} — {aniversariantesMes.length} aniversariante{aniversariantesMes.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Link href="/membros">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                Ver membros <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {aniversariantesExibir.length > 0 ? (
              <div className="space-y-2">
                {aniversariantesExibir.map((aniv) => (
                  <Link key={aniv.id} href={`/membros/${aniv.id}`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Cake className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{aniv.nome}</p>
                        <p className="text-xs text-muted-foreground">Dia {aniv.dia}</p>
                      </div>
                    </div>
                  </Link>
                ))}
                {aniversariantesMes.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{aniversariantesMes.length - 5} outros
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Cake className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum aniversariante este mês</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximos Cultos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-sm font-semibold">Próximos Cultos</CardTitle>
              <CardDescription className="text-xs mt-0.5">Escalas programadas</CardDescription>
            </div>
            <Link href="/escalas">
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {proximosCultos?.length > 0 ? (
              <div className="space-y-2">
                {proximosCultos.map((culto: any) => (
                  <Link key={culto.id} href={`/escalas/${culto.escala_id ?? culto.id}`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted transition-colors">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Church className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{culto.tipo_culto || "Culto"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(culto.data_culto)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Church className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum culto programado</p>
                <Link href="/escalas/nova">
                  <Button variant="outline" size="sm" className="mt-3 h-8 text-xs">
                    Criar escala
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ações rápidas */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            {[
              { label: "Novo Membro",  href: "/membros/novo",   icon: Users },
              { label: "Novo Evento",  href: "/eventos/novo",   icon: CalendarDays },
              { label: "Financeiro",   href: "/financeiro",     icon: Wallet },
              { label: "Nova Escala",  href: "/escalas",        icon: UserCheck },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm font-normal">
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
