import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Users,
  Church,
  DollarSign,
  Calendar,
  TrendingUp,
  Flame,
  UserCheck,
  Heart,
  MessageSquare,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Buscar perfil e igreja
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) return null

  const { data: igreja } = await (supabase as any)
    .from("igrejas")
    .select("*")
    .eq("id", profile.igreja_id || "")
    .single()

  // Buscar estatísticas reais
  const { count: totalMembros } = await (supabase as any)
    .from("membros")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id)
    .eq("status", "ativo")

  const { count: totalEventos } = await (supabase as any)
    .from("eventos")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id)
    .gte("data_inicio", new Date().toISOString().split('T')[0])

  const { count: totalMinisterios } = await (supabase as any)
    .from("ministerios")
    .select("*", { count: "exact", head: true })
    .eq("igreja_id", profile.igreja_id)
    .eq("ativo", true)

  // Buscar próximos eventos
  const { data: proximosEventos } = await (supabase as any)
    .from("eventos")
    .select("*")
    .eq("igreja_id", profile.igreja_id)
    .gte("data_inicio", new Date().toISOString().split('T')[0])
    .order("data_inicio")
    .limit(5)

  // Buscar membros recentes
  const { data: membrosRecentes } = await (supabase as any)
    .from("membros")
    .select("nome, data_entrada")
    .eq("igreja_id", profile.igreja_id)
    .order("created_at", { ascending: false })
    .limit(5)

  return (
    <div className="space-y-6">
      {/* Header com saudação */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-secondary">
          Olá, {profile?.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Aqui está o resumo de {igreja?.nome || 'sua igreja'}
        </p>
      </div>

      {/* Banner da Igreja */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10">
        <CardContent className="p-8">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-full bg-accent/20">
              <Flame className="h-12 w-12 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-secondary mb-1">
                {igreja?.nome || 'Igreja Pentecostal Vale da Bênção'}
              </h2>
              <p className="text-muted-foreground capitalize">
                {igreja?.tipo || 'Sede'} • Sistema de Gestão Eclesiástica
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Membros Ativos
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{totalMembros || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total de membros cadastrados
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Próximos Eventos
            </CardTitle>
            <Calendar className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{totalEventos || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Eventos programados
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ministérios
            </CardTitle>
            <Church className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{totalMinisterios || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ministérios ativos
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Financeiro
            </CardTitle>
            <DollarSign className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{formatCurrency(0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Saldo do mês atual
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Próximos Eventos */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-secondary">Próximos Eventos</CardTitle>
              <Link href="/eventos">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  Ver todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Eventos programados para os próximos dias</CardDescription>
          </CardHeader>
          <CardContent>
            {proximosEventos && proximosEventos.length > 0 ? (
              <div className="space-y-3">
                {proximosEventos.map((evento: any) => (
                  <Link key={evento.id} href={`/eventos/${evento.id}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-primary/5 transition-colors cursor-pointer border border-primary/10">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Calendar className="h-4 w-4 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-secondary">{evento.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(evento.data_inicio)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum evento programado</p>
                <Link href="/eventos/novo">
                  <Button variant="outline" size="sm" className="mt-3 border-primary text-primary hover:bg-primary/10">
                    Criar Evento
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Membros Recentes */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-secondary">Membros Recentes</CardTitle>
              <Link href="/membros">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  Ver todos
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <CardDescription>Últimos membros cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            {membrosRecentes && membrosRecentes.length > 0 ? (
              <div className="space-y-3">
                {membrosRecentes.map((membro: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg border border-primary/10">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-secondary">{membro.nome}</p>
                      <p className="text-sm text-muted-foreground">
                        Membro desde {formatDate(membro.data_entrada)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum membro cadastrado</p>
                <Link href="/membros/novo">
                  <Button variant="outline" size="sm" className="mt-3 border-primary text-primary hover:bg-primary/10">
                    Adicionar Membro
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Atalhos Rápidos */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-secondary">Ações Rápidas</CardTitle>
          <CardDescription>Acesse rapidamente as principais funcionalidades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/membros/novo">
              <Button variant="outline" className="w-full justify-start border-primary/20 hover:bg-primary/5 hover:border-primary">
                <Users className="mr-2 h-4 w-4 text-primary" />
                Novo Membro
              </Button>
            </Link>
            <Link href="/eventos/novo">
              <Button variant="outline" className="w-full justify-start border-primary/20 hover:bg-primary/5 hover:border-primary">
                <Calendar className="mr-2 h-4 w-4 text-accent" />
                Novo Evento
              </Button>
            </Link>
            <Link href="/financeiro">
              <Button variant="outline" className="w-full justify-start border-primary/20 hover:bg-primary/5 hover:border-primary">
                <DollarSign className="mr-2 h-4 w-4 text-accent" />
                Financeiro
              </Button>
            </Link>
            <Link href="/escalas/nova">
              <Button variant="outline" className="w-full justify-start border-primary/20 hover:bg-primary/5 hover:border-primary">
                <UserCheck className="mr-2 h-4 w-4 text-primary" />
                Nova Escala
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Flame className="h-5 w-5 text-accent mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-secondary">Sistema configurado com sucesso!</p>
              <p className="text-muted-foreground">✅ Igreja: {igreja?.nome || 'Igreja Pentecostal Vale da Bênção'}</p>
              <p className="text-muted-foreground">✅ Usuário: {profile?.nome} ({profile?.role})</p>
              <p className="text-muted-foreground">⚠️ Para ativar todas as funcionalidades, execute o schema completo do banco de dados</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
