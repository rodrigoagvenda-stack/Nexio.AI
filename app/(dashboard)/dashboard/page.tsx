import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import {
  Users,
  Church,
  DollarSign,
  Calendar,
  TrendingUp,
  Flame,
  ArrowUp,
  ArrowDown,
  Eye,
} from "lucide-react"
import type { Profile, Igreja } from "@/types/database.types"
import Link from "next/link"

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

  // Buscar estatísticas reais (se as tabelas existirem)
  const { count: membrosCount } = await (supabase as any)
    .from("membros")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id)
    .eq("status", "ativo")

  const { count: eventosCount } = await (supabase as any)
    .from("eventos")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id)
    .gte("data_inicio", new Date().toISOString().split('T')[0])

  const totalMembros = membrosCount || 0
  const totalEventos = eventosCount || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Olá, Bom Dia</p>
          <h2 className="text-3xl font-bold tracking-tight">{profile?.nome?.split(' ')[0] || 'Administrador'}</h2>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="rounded-full">
            🌙
          </Button>
          <Button variant="outline" size="icon" className="rounded-full relative">
            🔔
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-accent text-xs text-white flex items-center justify-center">
              2
            </span>
          </Button>
        </div>
      </div>

      {/* Main Stats Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white relative p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm opacity-90 mb-2">Parabéns, {profile?.nome?.split(' ')[0]}! 🎉</p>
              <h3 className="text-4xl font-bold mb-2">
                {formatCurrency(0)}
              </h3>
              <p className="text-sm opacity-80 mb-6">Suas ofertas este mês têm sido excelentes</p>
              <Link href="/financeiro">
                <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                  Ver Finanças
                </Button>
              </Link>
            </div>
            <div className="text-8xl opacity-20">
              🎁
            </div>
          </div>
        </div>
      </Card>

      {/* Statistics Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Estatísticas</h3>
          <p className="text-sm text-muted-foreground">Atualizado no último mês</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Ofertas Anuais</p>
                <h3 className="text-2xl font-bold">{formatCurrency(0)}</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" /> +15%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Membros</p>
                <h3 className="text-2xl font-bold">{totalMembros}</h3>
                <p className="text-xs text-muted-foreground mt-1">Total de membros ativos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-orange-100">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Eventos</p>
                <h3 className="text-2xl font-bold">{totalEventos}</h3>
                <p className="text-xs text-muted-foreground mt-1">Programados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Church className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Receita</p>
                <h3 className="text-2xl font-bold">{formatCurrency(0)}</h3>
                <p className="text-xs text-muted-foreground mt-1">Este mês</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Saldo</p>
                <h3 className="text-2xl font-bold">{formatCurrency(0)}</h3>
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" /> +12%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Charts and Reports Row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Report */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Relatório de Receitas</CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground">Entradas</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground">Saídas</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div>
                <p className="text-2xl font-bold">{formatCurrency(0)}</p>
                <p className="text-sm text-muted-foreground">Orçamento: {formatCurrency(0)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Placeholder for chart */}
            <div className="h-64 flex items-end justify-around gap-2">
              {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'].map((month, i) => (
                <div key={month} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500 rounded-t"
                      style={{ height: `${Math.random() * 120 + 40}px` }}
                    ></div>
                    <div
                      className="w-full bg-green-500 rounded-b"
                      style={{ height: `${Math.random() * 80 + 20}px` }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">{month}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Button className="bg-primary hover:bg-primary/90">Aumentar Orçamento</Button>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Orders and Earnings */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ofertas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h3 className="text-4xl font-bold">0</h3>
                <p className="text-sm text-green-600">68.2% mais ofertas que no mês passado</p>
              </div>
              <div className="mt-4 h-20 flex items-end justify-around">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 bg-green-500 rounded-t"
                    style={{ height: `${Math.random() * 60 + 20}px` }}
                  ></div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dízimos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h3 className="text-4xl font-bold">{formatCurrency(0)}</h3>
                <p className="text-sm text-muted-foreground">68.2% mais dízimos que no mês passado</p>
              </div>
              <div className="mt-4 flex items-center justify-center">
                <div className="relative h-32 w-32">
                  <svg className="transform -rotate-90 h-32 w-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-muted/20"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - 0.89)}`}
                      className="text-green-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">89.2%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Reminders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lembretes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100">
                <div className="aspect-video rounded-lg bg-white/50 mb-3 flex items-center justify-center text-4xl">
                  📅
                </div>
                <h4 className="font-semibold mb-1">Próximo Culto</h4>
                <p className="text-sm text-muted-foreground mb-3">Prepare-se para o culto de domingo</p>
                <div className="flex items-center gap-2 text-sm mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>Dom, 14 Jan 2026</span>
                </div>
                <div className="flex items-center gap-2 text-sm mb-4">
                  <Church className="h-4 w-4" />
                  <span>{igreja?.nome || 'Igreja'}</span>
                </div>
                <Button className="w-full bg-primary/20 hover:bg-primary/30 text-primary">
                  Lembrete Ativado
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales Report Table */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Relatório de Atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Atividade</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Categoria</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Participantes</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">Culto Dominical</p>
                        <p className="text-sm text-muted-foreground">culto@igreja.com</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded bg-blue-100">
                          <Church className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="text-sm">Culto</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{totalMembros > 0 ? totalMembros : '23.4k'}</td>
                    <td className="py-3 px-4 text-sm font-medium">{formatCurrency(0)}</td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <ArrowUp className="h-3 w-3" /> 68%
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">Escola Bíblica</p>
                        <p className="text-sm text-muted-foreground">ebd@igreja.com</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded bg-green-100">
                          <Users className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="text-sm">Ensino</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">12.8k</td>
                    <td className="py-3 px-4 text-sm font-medium">{formatCurrency(0)}</td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-red-600 flex items-center gap-1">
                        <ArrowDown className="h-3 w-3" /> 18%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-center">
              <Button variant="ghost" className="text-primary">
                Ver Mais
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Very Bottom Row */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Goal Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Visão Geral de Metas</CardTitle>
            <CardDescription>Out, 2025</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mb-6">
              <div className="relative h-48 w-48">
                <svg className="transform -rotate-90 h-48 w-48">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="currentColor"
                    strokeWidth="16"
                    fill="none"
                    className="text-muted/20"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    stroke="url(#gradient)"
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 80}`}
                    strokeDashoffset={`${2 * Math.PI * 80 * (1 - 0.78)}`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">78%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Completado</p>
                <p className="text-2xl font-bold">1,762k</p>
              </div>
              <div>
                <p className="text-muted-foreground">Em Progresso</p>
                <p className="text-2xl font-bold">762k</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Transações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium">Ofertas Domingo</p>
                    <p className="text-sm text-muted-foreground">Entrada</p>
                  </div>
                </div>
                <span className="font-semibold text-green-600">+ {formatCurrency(42)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium">Materiais & Equipamentos</p>
                    <p className="text-sm text-muted-foreground">Transferência Bancária</p>
                  </div>
                </div>
                <span className="font-semibold text-red-600">- {formatCurrency(526)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Dízimos Mensais</p>
                    <p className="text-sm text-muted-foreground">Dinheiro</p>
                  </div>
                </div>
                <span className="font-semibold text-red-600">- {formatCurrency(110)}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Button variant="ghost" className="text-primary">
                Ver Mais
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <p>✅ Login configurado</p>
            <p>✅ Igreja cadastrada: {igreja?.nome || 'Igreja Pentecostal Vale da Bênção'}</p>
            <p>⚠️ Execute o schema completo para ativar todas as funcionalidades</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
