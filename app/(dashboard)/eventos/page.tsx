import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, MapPin, Users, DollarSign } from "lucide-react"
import Link from "next/link"
import { formatDate, formatCurrency } from "@/lib/utils"
import type { Evento } from "@/types/database.types"

export default async function EventosPage() {
  const supabase = await createClient()

  // Buscar usuário autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-lg text-muted-foreground">
            Você precisa estar autenticado para acessar esta página
          </p>
        </div>
      </div>
    )
  }

  // Buscar perfil do usuário
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("igreja_id")
    .eq("id", user.id)
    .single()

  let eventos: any[] = []

  // Buscar eventos da igreja
  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("eventos")
      .select(`
        *,
        igrejas:igreja_id (
          nome
        ),
        responsavel:responsavel_id (
          nome
        )
      `)
      .eq("igreja_id", profile.igreja_id)
      .order("data_inicio", { ascending: false })

    eventos = data || []
  }

  // Separar eventos futuros e passados
  const hoje = new Date().toISOString().split('T')[0]
  const eventosFuturos = eventos.filter(e => e.data_inicio >= hoje)
  const eventosPassados = eventos.filter(e => e.data_inicio < hoje)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Eventos</h2>
          <p className="text-muted-foreground">
            Gerencie os eventos da igreja
          </p>
        </div>
        <Link href="/eventos/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Evento
          </Button>
        </Link>
      </div>

      {/* Eventos Futuros */}
      {eventosFuturos.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Próximos Eventos</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {eventosFuturos.map((evento) => (
              <Link key={evento.id} href={`/eventos/${evento.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="line-clamp-2">{evento.nome}</CardTitle>
                        {evento.tipo && (
                          <Badge variant="outline" className="mt-2 capitalize">
                            {evento.tipo}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(evento.data_inicio)}</span>
                      {evento.hora_inicio && <span>às {evento.hora_inicio}</span>}
                    </div>
                    {evento.local && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{evento.local}</span>
                      </div>
                    )}
                    {evento.capacidade && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Capacidade: {evento.capacidade}</span>
                      </div>
                    )}
                    {evento.valor_inscricao > 0 && (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <DollarSign className="h-4 w-4" />
                        <span>{formatCurrency(evento.valor_inscricao)}</span>
                      </div>
                    )}
                    {evento.inscricoes_abertas && (
                      <Badge className="bg-green-500">Inscrições Abertas</Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Eventos Passados */}
      {eventosPassados.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Eventos Anteriores</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {eventosPassados.map((evento) => (
              <Link key={evento.id} href={`/eventos/${evento.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full opacity-80">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="line-clamp-2">{evento.nome}</CardTitle>
                        {evento.tipo && (
                          <Badge variant="outline" className="mt-2 capitalize">
                            {evento.tipo}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(evento.data_inicio)}</span>
                    </div>
                    {evento.local && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{evento.local}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Nenhum evento */}
      {eventos.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum evento cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie o primeiro evento da sua igreja
            </p>
            <Link href="/eventos/novo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Evento
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
