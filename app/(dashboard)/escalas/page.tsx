import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Calendar, Users } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

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
      .select("*, ministerio:ministerio_id(nome, cor)")
      .eq("igreja_id", profile.igreja_id)
      .gte("data", new Date().toISOString().split('T')[0])
      .order("data")
      .limit(10)

    escalas = data || []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Escalas</h2>
          <p className="text-muted-foreground">
            Gerencie as escalas de cultos e eventos
          </p>
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
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma escala programada</h3>
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
        <div className="space-y-4">
          {escalas.map((escala) => (
            <Link key={escala.id} href={`/escalas/${escala.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{escala.tipo}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(escala.data)} {escala.hora_inicio && `às ${escala.hora_inicio}`}
                      </CardDescription>
                    </div>
                    {escala.ministerio && (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: escala.ministerio.cor }}
                        ></div>
                        <span className="text-sm">{escala.ministerio.nome}</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
