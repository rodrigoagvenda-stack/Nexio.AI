import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, Mail, Phone, MapPin, Calendar, User, Church } from "lucide-react"
import Link from "next/link"
import { formatDate, formatPhone } from "@/lib/utils"
import { notFound } from "next/navigation"

interface PageProps {
  params: {
    id: string
  }
}

export default async function MembroDetailPage({ params }: PageProps) {
  const supabase = await createClient()

  // Buscar membro com dados da igreja
  const { data: membro, error } = await (supabase as any)
    .from("membros")
    .select(`
      *,
      igrejas:igreja_id (
        nome,
        tipo
      )
    `)
    .eq("id", params.id)
    .single()

  if (error || !membro) {
    notFound()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-green-500"
      case "inativo":
        return "bg-red-500"
      case "visitante":
        return "bg-blue-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/membros">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
        <Link href={`/membros/${membro.id}/editar`}>
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
        </Link>
      </div>

      {/* Informações Principais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{membro.nome}</CardTitle>
              <CardDescription>
                {membro.cargo || "Membro"}
              </CardDescription>
            </div>
            <Badge className={getStatusColor(membro.status)}>
              {membro.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Contato */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Informações de Contato</h3>
              {membro.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${membro.email}`} className="hover:underline">
                    {membro.email}
                  </a>
                </div>
              )}
              {membro.telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${membro.telefone}`} className="hover:underline">
                    {formatPhone(membro.telefone)}
                  </a>
                </div>
              )}
              {membro.endereco && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    {membro.endereco.rua && (
                      <p>{membro.endereco.rua}{membro.endereco.numero ? `, ${membro.endereco.numero}` : ''}</p>
                    )}
                    {membro.endereco.complemento && (
                      <p className="text-muted-foreground">{membro.endereco.complemento}</p>
                    )}
                    {membro.endereco.bairro && (
                      <p>{membro.endereco.bairro}</p>
                    )}
                    {(membro.endereco.cidade || membro.endereco.estado) && (
                      <p>{membro.endereco.cidade}{membro.endereco.estado ? ` - ${membro.endereco.estado}` : ''}</p>
                    )}
                    {membro.endereco.cep && (
                      <p className="text-muted-foreground">CEP: {membro.endereco.cep}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Dados Pessoais</h3>
              {membro.data_nascimento && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Nascimento: {formatDate(membro.data_nascimento)}</span>
                </div>
              )}
              {membro.cpf && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>CPF: {membro.cpf}</span>
                </div>
              )}
              {membro.sexo && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">Sexo: {membro.sexo}</span>
                </div>
              )}
              {membro.estado_civil && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">Estado Civil: {membro.estado_civil}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados Eclesiásticos */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Eclesiásticos</CardTitle>
          <CardDescription>Informações sobre a vida na igreja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              {membro.igrejas && (
                <div className="flex items-center gap-2 text-sm">
                  <Church className="h-4 w-4 text-muted-foreground" />
                  <span>{membro.igrejas.nome}</span>
                  <Badge variant="outline" className="capitalize">
                    {membro.igrejas.tipo}
                  </Badge>
                </div>
              )}
              {membro.data_entrada && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Membro desde: {formatDate(membro.data_entrada)}</span>
                </div>
              )}
              {membro.data_batismo && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Batizado em: {formatDate(membro.data_batismo)}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {membro.cargo && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Cargo/Função:</span>
                  <p className="font-medium">{membro.cargo}</p>
                </div>
              )}
              <div className="text-sm">
                <span className="text-muted-foreground">Dizimista:</span>
                <p className="font-medium">{membro.dizimista ? "Sim" : "Não"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      {membro.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {membro.observacoes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Informações do Sistema */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 text-xs text-muted-foreground md:grid-cols-2">
            <div>
              <span className="font-medium">Cadastrado em:</span> {formatDate(membro.created_at)}
            </div>
            <div>
              <span className="font-medium">Última atualização:</span> {formatDate(membro.updated_at)}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
