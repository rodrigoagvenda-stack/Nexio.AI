import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react"

export default async function FinanceiroPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("igreja_id")
    .eq("id", user.id)
    .single()

  const data_inicio = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
  const data_fim = new Date().toISOString().split('T')[0]

  // Buscar estatísticas
  const { data: stats } = await supabase.rpc("estatisticas_financeiras", {
    p_igreja_id: profile?.igreja_id,
    p_data_inicio: data_inicio,
    p_data_fim: data_fim,
  })

  const estatisticas = stats?.[0] || {
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
    total_dizimos: 0,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Financeiro</h2>
        <p className="text-muted-foreground">
          Controle financeiro completo da igreja
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(estatisticas.total_entradas)}
            </div>
            <p className="text-xs text-muted-foreground">
              No período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(estatisticas.total_saidas)}
            </div>
            <p className="text-xs text-muted-foreground">
              No período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(estatisticas.saldo)}
            </div>
            <p className="text-xs text-muted-foreground">
              Resultado do período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dízimos</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(estatisticas.total_dizimos)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total de dízimos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos Lançamentos</CardTitle>
          <CardDescription>
            Movimentações financeiras recentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Implemente a tabela de lançamentos aqui
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
