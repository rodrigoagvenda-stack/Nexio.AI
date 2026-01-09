import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Church, DollarSign, Calendar } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Buscar perfil do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, igrejas(*)")
    .eq("id", user.id)
    .single()

  // Buscar estatísticas básicas
  const { count: totalMembros } = await supabase
    .from("membros")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile?.igreja_id || "")
    .eq("status", "ativo")

  const { count: totalIgrejas } = await supabase
    .from("igrejas")
    .select("*", { count: "exact", head: true })

  const stats = [
    {
      name: "Membros Ativos",
      value: totalMembros || 0,
      icon: Users,
      change: "+4.75%",
      changeType: "positive",
    },
    {
      name: "Igrejas",
      value: totalIgrejas || 0,
      icon: Church,
      change: "+0%",
      changeType: "neutral",
    },
    {
      name: "Entradas do Mês",
      value: "R$ 0,00",
      icon: DollarSign,
      change: "+0%",
      changeType: "neutral",
    },
    {
      name: "Eventos Próximos",
      value: 0,
      icon: Calendar,
      change: "+0%",
      changeType: "neutral",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Bem-vindo, {profile?.nome}!
        </h2>
        <p className="text-muted-foreground">
          Aqui está um resumo do que está acontecendo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.name}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.change} desde o último mês
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>
              Últimas ações realizadas no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium">Sistema inicializado</p>
                  <p className="text-sm text-muted-foreground">
                    Bem-vindo ao Sistema de Gestão para Igrejas
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Próximos Cultos</CardTitle>
            <CardDescription>
              Escalas confirmadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nenhuma escala cadastrada ainda.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
