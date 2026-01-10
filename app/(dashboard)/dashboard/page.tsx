import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import {
  Users,
  Church,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Flame,
  UserPlus,
  BarChart3
} from "lucide-react"
import { StatsCard } from "@/components/dashboard/stats-card"
import { WelcomeCard } from "@/components/dashboard/welcome-card"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { UpcomingEvents } from "@/components/dashboard/upcoming-events"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import type { Profile, Igreja } from "@/types/database.types"

type ProfileWithIgreja = Profile & {
  igrejas: Igreja | null
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, igrejas(*)")
    .eq("id", user.id)
    .single<ProfileWithIgreja>()

  // Estatísticas
  const { count: totalMembros } = await supabase
    .from("membros")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile?.igreja_id || "")
    .eq("status", "ativo")

  const { count: totalIgrejas } = await supabase
    .from("igrejas")
    .select("*", { count: "exact", head: true })

  const { count: totalEventos } = await supabase
    .from("eventos")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile?.igreja_id || "")
    .gte("data_inicio", new Date().toISOString().split('T')[0])

  // Estatísticas financeiras
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

  const { data: statsFinanceiro } = await supabase
    .rpc("estatisticas_financeiras", {
      p_igreja_id: profile?.igreja_id,
      p_data_inicio: inicioMes,
      p_data_fim: fimMes,
    })

  const stats = statsFinanceiro?.[0] || {
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
    total_dizimos: 0,
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Olá, {profile?.nome?.split(' ')[0]}! 👋
          </h2>
          <p className="text-muted-foreground">
            Aqui está o que está acontecendo na {profile?.igrejas?.nome || 'igreja'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2">
            <Flame className="h-5 w-5 text-accent" />
            <span className="font-semibold text-primary">Igreja Pentecostal</span>
          </div>
        </div>
      </div>

      {/* Welcome Card */}
      <WelcomeCard
        userName={profile?.nome || ''}
        churchName={profile?.igrejas?.nome || ''}
        totalMembers={totalMembros || 0}
      />

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Membros Ativos"
          value={totalMembros || 0}
          icon={Users}
          description="+12% desde o último mês"
          trend="up"
          gradient="primary"
        />

        <StatsCard
          title="Entradas do Mês"
          value={formatCurrency(stats.total_entradas)}
          icon={TrendingUp}
          description="Ofertas e dízimos"
          trend="up"
          gradient="success"
        />

        <StatsCard
          title="Eventos Próximos"
          value={totalEventos || 0}
          icon={Calendar}
          description="Programados este mês"
          trend="neutral"
          gradient="orange"
        />

        <StatsCard
          title="Saldo do Mês"
          value={formatCurrency(stats.saldo)}
          icon={DollarSign}
          description={stats.saldo >= 0 ? "Superávit" : "Déficit"}
          trend={stats.saldo >= 0 ? "up" : "down"}
          gradient="primary"
        />
      </div>

      {/* Charts and Details */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Chart */}
        <div className="lg:col-span-4">
          <RevenueChart igrejaId={profile?.igreja_id || ''} />
        </div>

        {/* Quick Stats */}
        <div className="lg:col-span-3 space-y-6">
          <QuickActions />
          <UpcomingEvents igrejaId={profile?.igreja_id || ''} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity />

        <Card className="chart-container">
          <CardHeader>
            <CardTitle>Dízimos e Ofertas</CardTitle>
            <CardDescription>Contribuições financeiras este mês</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-success/5">
                <div>
                  <p className="text-sm text-muted-foreground">Dízimos</p>
                  <p className="text-2xl font-bold text-success">
                    {formatCurrency(stats.total_dizimos)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5">
                <div>
                  <p className="text-sm text-muted-foreground">Ofertas</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(stats.total_entradas - stats.total_dizimos)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Church className="h-6 w-6 text-primary" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-accent/5">
                <div>
                  <p className="text-sm text-muted-foreground">Total Arrecadado</p>
                  <p className="text-2xl font-bold text-accent">
                    {formatCurrency(stats.total_entradas)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-accent" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
