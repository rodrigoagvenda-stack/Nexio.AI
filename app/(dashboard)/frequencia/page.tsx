import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, UserCheck, Calendar, TrendingUp } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function FrequenciaPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("igreja_id")
    .eq("id", user.id)
    .single()

  let frequencias: any[] = []

  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("frequencias")
      .select("*, culto_regular:culto_regular_id(tipo, dia_semana)")
      .eq("igreja_id", profile.igreja_id)
      .order("data", { ascending: false })
      .limit(10)

    frequencias = data || []
  }

  const totalPresencas = frequencias.reduce((sum, f) => sum + (f.total_presencas || 0), 0)
  const mediaPresencas = frequencias.length > 0 ? Math.round(totalPresencas / frequencias.length) : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Frequência</h2>
          <p className="text-muted-foreground">
            Controle de presença em cultos e eventos
          </p>
        </div>
        <Link href="/frequencia/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Registrar Frequência
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{frequencias.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Últimos registros</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Média de Presença</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mediaPresencas}</div>
            <p className="text-xs text-muted-foreground mt-1">Por culto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Presenças</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPresencas}</div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Crescimento
            </p>
          </CardContent>
        </Card>
      </div>

      {frequencias.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <UserCheck className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma frequência registrada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Comece a registrar a presença dos membros
            </p>
            <Link href="/frequencia/nova">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Registrar Primeira Frequência
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registros Recentes</CardTitle>
            <CardDescription>Últimas frequências registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {frequencias.map((freq) => (
                <Link key={freq.id} href={`/frequencia/${freq.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Calendar className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {freq.culto_regular?.tipo || 'Culto'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(freq.data)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{freq.total_presencas || 0} presentes</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
