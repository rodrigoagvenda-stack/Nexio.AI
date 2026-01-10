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
  const debugInfo: any = { steps: [] }

  try {
    debugInfo.steps.push('1. Creating Supabase client')
    const supabase = await createClient()

    debugInfo.steps.push('2. Getting user from auth')
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      debugInfo.steps.push('2a. No user found')
      return null
    }
    debugInfo.userId = user.id
    debugInfo.steps.push('2b. User found: ' + user.id)

    // Buscar perfil sem JOIN primeiro
    debugInfo.steps.push('3. Fetching profile')
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single<Profile>()

    if (profileError) {
      debugInfo.profileError = profileError
      debugInfo.steps.push('3a. Profile error')
    }

    if (!profile) {
      debugInfo.steps.push('3b. No profile found')
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold text-red-600">Erro: Perfil não encontrado</h1>
          <pre className="mt-4 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-96">{JSON.stringify({ profileError, debugInfo }, null, 2)}</pre>
        </div>
      )
    }

    debugInfo.profile = { id: profile.id, nome: profile.nome, igreja_id: profile.igreja_id }
    debugInfo.steps.push('3c. Profile loaded: ' + profile.nome)

    // Buscar igreja separadamente
    debugInfo.steps.push('4. Fetching igreja')
    const { data: igreja, error: igrejaError } = await supabase
      .from("igrejas")
      .select("*")
      .eq("id", profile.igreja_id || "")
      .single<Igreja>()

    if (igrejaError) {
      debugInfo.igrejaError = igrejaError
      debugInfo.steps.push('4a. Igreja error (pode ser normal se não existir)')
    }

    const profileWithIgreja: ProfileWithIgreja = {
      ...profile,
      igrejas: igreja
    }
    debugInfo.steps.push('4b. Igreja: ' + (igreja ? igreja.nome : 'null'))

    // Estatísticas - com try/catch individual
    debugInfo.steps.push('5. Fetching totalMembros')
    let totalMembros = 0
    try {
      const result = await (supabase as any)
        .from("membros")
        .select("*", { count: "exact", head: true })
        .eq("igreja_id", profileWithIgreja?.igreja_id || "")
        .eq("status", "ativo")
      totalMembros = result.count || 0
      debugInfo.steps.push('5a. totalMembros: ' + totalMembros)
    } catch (e: any) {
      debugInfo.membrosError = e.message
      debugInfo.steps.push('5b. Error fetching membros: ' + e.message)
    }

    debugInfo.steps.push('6. Fetching totalIgrejas')
    let totalIgrejas = 0
    try {
      const result = await (supabase as any)
        .from("igrejas")
        .select("*", { count: "exact", head: true })
      totalIgrejas = result.count || 0
      debugInfo.steps.push('6a. totalIgrejas: ' + totalIgrejas)
    } catch (e: any) {
      debugInfo.igrejasError = e.message
      debugInfo.steps.push('6b. Error fetching igrejas: ' + e.message)
    }

    debugInfo.steps.push('7. Fetching totalEventos')
    let totalEventos = 0
    try {
      const result = await (supabase as any)
        .from("eventos")
        .select("*", { count: "exact", head: true })
        .eq("igreja_id", profileWithIgreja?.igreja_id || "")
        .gte("data_inicio", new Date().toISOString().split('T')[0])
      totalEventos = result.count || 0
      debugInfo.steps.push('7a. totalEventos: ' + totalEventos)
    } catch (e: any) {
      debugInfo.eventosError = e.message
      debugInfo.steps.push('7b. Error fetching eventos: ' + e.message)
    }

    // Estatísticas financeiras
    debugInfo.steps.push('8. Calculating dates for stats')
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]
    debugInfo.dates = { inicioMes, fimMes }

    debugInfo.steps.push('9. Calling RPC estatisticas_financeiras')
    let stats = {
      total_entradas: 0,
      total_saidas: 0,
      saldo: 0,
      total_dizimos: 0,
      total_ofertas: 0,
    }

    try {
      const { data: statsFinanceiro, error: statsError } = await (supabase as any)
        .rpc("estatisticas_financeiras", {
          p_igreja_id: profileWithIgreja?.igreja_id || '',
          p_data_inicio: inicioMes,
          p_data_fim: fimMes,
        })

      if (statsError) {
        debugInfo.statsError = statsError
        debugInfo.steps.push('9a. Stats RPC error: ' + statsError.message)
      } else {
        stats = statsFinanceiro?.[0] || stats
        debugInfo.steps.push('9b. Stats loaded successfully')
      }
    } catch (e: any) {
      debugInfo.statsException = e.message
      debugInfo.steps.push('9c. Stats exception: ' + e.message)
    }

    debugInfo.steps.push('10. Rendering dashboard')
    debugInfo.stats = stats

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Olá, {profileWithIgreja?.nome?.split(' ')[0]}! 👋
          </h2>
          <p className="text-muted-foreground">
            Aqui está o que está acontecendo na {profileWithIgreja?.igrejas?.nome || 'igreja'}
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
        userName={profileWithIgreja?.nome || ''}
        churchName={profileWithIgreja?.igrejas?.nome || ''}
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
          <RevenueChart igrejaId={profileWithIgreja?.igreja_id || ''} />
        </div>

        {/* Quick Stats */}
        <div className="lg:col-span-3 space-y-6">
          <QuickActions />
          <UpcomingEvents igrejaId={profileWithIgreja?.igreja_id || ''} />
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
  } catch (error: any) {
    debugInfo.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    }

    console.error("Dashboard error:", error)
    console.error("Debug info:", debugInfo)

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600">ERRO NO DASHBOARD - DEBUG COMPLETO</h1>

        <div className="mt-4 space-y-4">
          <div>
            <h2 className="font-bold text-lg mb-2">Passos Executados:</h2>
            <ul className="list-disc list-inside text-sm space-y-1">
              {debugInfo.steps?.map((step: string, i: number) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-bold text-lg mb-2">Erro Principal:</h2>
            <pre className="p-4 bg-red-100 rounded text-xs overflow-auto max-h-40">
              {JSON.stringify(error.message, null, 2)}
            </pre>
          </div>

          <div>
            <h2 className="font-bold text-lg mb-2">Debug Info Completo:</h2>
            <pre className="p-4 bg-gray-100 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    )
  }
}
