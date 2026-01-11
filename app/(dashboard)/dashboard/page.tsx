import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import {
  Users,
  Church,
  DollarSign,
  Calendar,
  TrendingUp,
  Flame,
} from "lucide-react"
import type { Profile, Igreja } from "@/types/database.types"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Buscar perfil
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) return null

  // Buscar igreja separadamente
  const { data: igreja } = await (supabase as any)
    .from("igrejas")
    .select("*")
    .eq("id", profile.igreja_id || "")
    .single()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Olá, {profile?.nome?.split(' ')[0]}! 👋
          </h2>
          <p className="text-muted-foreground">
            Aqui está o que está acontecendo na {igreja?.nome || 'igreja'}
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
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="gradient-card text-white relative">
          <CardContent className="p-8 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-5 w-5 text-accent" />
                  <span className="text-sm font-medium text-white/90">
                    {igreja?.nome || 'Igreja Pentecostal Vale da Bênção'}
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-2">
                  Bem-vindo de volta, {profile?.nome?.split(' ')[0]}! 🙏
                </h2>
                <p className="text-white/80 mb-6">
                  Sistema de Gestão para Igrejas
                </p>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Membros Ativos</p>
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold tracking-tight mb-1">0</h3>
              <p className="text-xs font-medium text-muted-foreground">
                Aguardando dados
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Entradas do Mês</p>
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold tracking-tight mb-1">{formatCurrency(0)}</h3>
              <p className="text-xs font-medium text-muted-foreground">
                Ofertas e dízimos
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Eventos Próximos</p>
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-accent/10 to-accent/5">
                <Calendar className="h-5 w-5 text-accent" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold tracking-tight mb-1">0</h3>
              <p className="text-xs font-medium text-muted-foreground">
                Programados este mês
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card group">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">Saldo do Mês</p>
              <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-bold tracking-tight mb-1">{formatCurrency(0)}</h3>
              <p className="text-xs font-medium text-muted-foreground">
                Superávit
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Bem-vindo ao Sistema de Gestão</CardTitle>
          <CardDescription>
            Configure seu sistema para começar a gerenciar sua igreja
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>✅ Login configurado</p>
            <p>✅ Igreja cadastrada: {igreja?.nome || 'Igreja Pentecostal Vale da Bênção'}</p>
            <p>⏳ Execute o schema completo para criar as tabelas de membros, eventos e financeiro</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
