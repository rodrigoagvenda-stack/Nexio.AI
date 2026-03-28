import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, MapPin, Users, DollarSign, Clock, User } from "lucide-react"
import Link from "next/link"
import { formatDate, formatCurrency } from "@/lib/utils"
import { notFound } from "next/navigation"

interface PageProps {
  params: {
    id: string
  }
}

export default async function EventoDetailPage({ params }: PageProps) {
  const supabase = await createClient()

  // Buscar evento com dados relacionados
  const { data: evento, error } = await (supabase as any)
    .from("eventos")
    .select(`
      *,
      igrejas:igreja_id (
        nome,
        tipo
      ),
      responsavel:responsavel_id (
        nome,
        telefone,
        email
      )
    `)
    .eq("id", params.id)
    .single()

  if (error || !evento) {
    notFound()
  }

  // Buscar número de inscrições
  const { count: inscricoesCount } = await (supabase as any)
    .from("eventos_inscricoes")
    .select("*", { count: "exact", head: true })
    .eq("evento_id", params.id)

  const totalInscricoes = inscricoesCount || 0

  // Calcular vagas disponíveis
  const vagasDisponiveis = evento.capacidade ? evento.capacidade - totalInscricoes : null

  // Verificar se o evento já passou
  const hoje = new Date().toISOString().split('T')[0]
  const eventoPpassado = evento.data_inicio < hoje

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/eventos">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </div>

      {/* Informações Principais */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-3xl mb-2">{evento.nome}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                {evento.tipo && (
                  <Badge variant="outline" className="capitalize">
                    {evento.tipo}
                  </Badge>
                )}
                {eventoPpassado ? (
                  <Badge variant="secondary">Evento Realizado</Badge>
                ) : evento.inscricoes_abertas ? (
                  <Badge className="bg-[#C1BC7A]">Inscrições Abertas</Badge>
                ) : (
                  <Badge variant="secondary">Inscrições Fechadas</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Descrição */}
          {evento.descricao && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Sobre o Evento</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {evento.descricao}
              </p>
            </div>
          )}

          {/* Informações Principais */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Data e Horário</h3>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{formatDate(evento.data_inicio)}</p>
                  {evento.data_fim && evento.data_fim !== evento.data_inicio && (
                    <p className="text-muted-foreground text-xs">
                      até {formatDate(evento.data_fim)}
                    </p>
                  )}
                </div>
              </div>
              {(evento.hora_inicio || evento.hora_fim) && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {evento.hora_inicio && <span>{evento.hora_inicio}</span>}
                    {evento.hora_fim && evento.hora_inicio && <span> - </span>}
                    {evento.hora_fim && <span>{evento.hora_fim}</span>}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Local</h3>
              {evento.local ? (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{evento.local}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Local não informado</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inscrições e Vagas */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inscrições</CardTitle>
            <CardDescription>Informações sobre as inscrições</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {evento.capacidade && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">
                    {totalInscricoes} / {evento.capacidade} inscritos
                  </p>
                  {vagasDisponiveis !== null && (
                    <p className="text-xs text-muted-foreground">
                      {vagasDisponiveis > 0
                        ? `${vagasDisponiveis} vagas disponíveis`
                        : "Evento lotado"}
                    </p>
                  )}
                </div>
              </div>
            )}
            {!evento.capacidade && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p>{totalInscricoes} inscritos - Vagas ilimitadas</p>
              </div>
            )}
            {evento.valor_inscricao > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Valor da Inscrição</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(evento.valor_inscricao)}
                  </p>
                </div>
              </div>
            )}
            {evento.valor_inscricao === 0 && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium text-[#8a8345]">Gratuito</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Responsável */}
        {evento.responsavel && (
          <Card>
            <CardHeader>
              <CardTitle>Responsável</CardTitle>
              <CardDescription>Informações de contato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{evento.responsavel.nome}</p>
              </div>
              {evento.responsavel.telefone && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Telefone</p>
                  <a
                    href={`tel:${evento.responsavel.telefone}`}
                    className="hover:underline"
                  >
                    {evento.responsavel.telefone}
                  </a>
                </div>
              )}
              {evento.responsavel.email && (
                <div className="text-sm">
                  <p className="text-muted-foreground">E-mail</p>
                  <a
                    href={`mailto:${evento.responsavel.email}`}
                    className="hover:underline"
                  >
                    {evento.responsavel.email}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Igreja */}
      {evento.igrejas && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">Organizado por:</span>
              <span>{evento.igrejas.nome}</span>
              <Badge variant="outline" className="capitalize">
                {evento.igrejas.tipo}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações do Sistema */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 text-xs text-muted-foreground md:grid-cols-2">
            <div>
              <span className="font-medium">Criado em:</span> {formatDate(evento.created_at)}
            </div>
            <div>
              <span className="font-medium">Última atualização:</span> {formatDate(evento.updated_at)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
