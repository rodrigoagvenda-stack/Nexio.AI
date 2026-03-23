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

  const { data: proximosEventos } = await (supabase as any)
    .from("eventos").select("*")
    .eq("igreja_id", profile.igreja_id)
    .gte("data_inicio", new Date().toISOString().split("T")[0])
    .order("data_inicio").limit(5)

  const { data: membrosRecentes } = await (supabase as any)
    .from("membros").select("nome, data_entrada")
    .eq("igreja_id", profile.igreja_id)
    .order("created_at", { ascending: false }).limit(5)

  const stats = [
    { label: "Membros ativos",    value: totalMembros ?? 0,        icon: Users,     href: "/membros" },
    { label: "Próximos eventos",  value: totalEventos ?? 0,        icon: CalendarDays, href: "/eventos" },
    { label: "Ministérios",       value: totalMinisterios ?? 0,    icon: Building2, href: "/ministerios" },
    { label: "Saldo do mês",      value: formatCurrency(0),        icon: Wallet,    href: "/financeiro" },
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Bom dia, {profile.nome?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {igreja?.nome || "Igreja Pentecostal Vale da Bênção"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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

      {/* Content grid */}
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
