import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar } from "lucide-react"
import Link from "next/link"

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  confirmando: "Confirmando",
  finalizada: "Finalizada",
  enviada: "Enviada",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "secondary",
  confirmando: "default",
  finalizada: "default",
  enviada: "outline",
}

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

export default async function EscalasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("igreja_id")
    .eq("id", user.id)
    .single()

  let escalas: any[] = []

  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("escalas")
      .select("id, mes, ano, status, data_geracao")
      .eq("igreja_id", profile.igreja_id)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .limit(20)

    escalas = data || []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Escalas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerencie as escalas de cultos e eventos</p>
        </div>
        <Link href="/escalas/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Escala
          </Button>
        </Link>
      </div>

      {escalas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma escala encontrada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie a primeira escala para seus cultos e eventos
            </p>
            <Link href="/escalas/nova">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeira Escala
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {escalas.map((escala) => (
            <Link key={escala.id} href={`/escalas/${escala.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {MESES[escala.mes]} {escala.ano}
                    </CardTitle>
                    <Badge variant={STATUS_VARIANT[escala.status] ?? "secondary"}>
                      {STATUS_LABELS[escala.status] ?? escala.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Gerada em {new Date(escala.data_geracao).toLocaleDateString("pt-BR")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
