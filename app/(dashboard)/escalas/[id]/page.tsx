import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  confirmando: "Confirmando",
  finalizada: "Finalizada",
  enviada: "Enviada",
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

const FUNCOES = [
  { key: "membro_oracao", label: "Oração" },
  { key: "membro_louvor", label: "Louvor" },
  { key: "membro_pregacao", label: "Pregação" },
  { key: "membro_som", label: "Som" },
  { key: "membro_recepcao", label: "Recepção" },
  { key: "membro_midia", label: "Mídia" },
  { key: "membro_infantil", label: "Infantil" },
]

export default async function EscalaDetalhePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: escala } = await (supabase as any)
    .from("escalas")
    .select(`
      id, mes, ano, status, data_geracao,
      escalas_detalhes (
        id, data_culto, dia_semana, horario, tipo_culto,
        membro_oracao:membros!membro_oracao_id(id, nome),
        membro_louvor:membros!membro_louvor_id(id, nome),
        membro_pregacao:membros!membro_pregacao_id(id, nome),
        membro_som:membros!membro_som_id(id, nome),
        membro_recepcao:membros!membro_recepcao_id(id, nome),
        membro_midia:membros!membro_midia_id(id, nome),
        membro_infantil:membros!membro_infantil_id(id, nome)
      )
    `)
    .eq("id", params.id)
    .single()

  if (!escala) notFound()

  const detalhes: any[] = escala.escalas_detalhes || []
  detalhes.sort((a: any, b: any) => a.data_culto.localeCompare(b.data_culto))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/escalas">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {MESES[escala.mes]} {escala.ano}
            </h1>
            <Badge variant="secondary">{STATUS_LABELS[escala.status] ?? escala.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerada em {new Date(escala.data_geracao).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      {detalhes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum culto encontrado nesta escala.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {detalhes.map((d: any) => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    {DIAS_SEMANA[d.dia_semana]},{" "}
                    {new Date(d.data_culto + "T00:00:00").toLocaleDateString("pt-BR")}
                    {d.horario && ` — ${d.horario}`}
                  </CardTitle>
                  {d.tipo_culto && (
                    <span className="text-xs text-muted-foreground capitalize">{d.tipo_culto}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  {FUNCOES.map(({ key, label }) => {
                    const membro = d[key]
                    return (
                      <div key={key} className="flex flex-col">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="font-medium">{membro?.nome ?? "—"}</span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
