import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, User } from "lucide-react"
import Link from "next/link"

export default async function MinisteriosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("igreja_id")
    .eq("id", user.id)
    .single()

  let ministerios: any[] = []

  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("ministerios")
      .select(`
        *,
        lider:lider_id (
          nome
        )
      `)
      .eq("igreja_id", profile.igreja_id)
      .eq("ativo", true)
      .order("nome")

    ministerios = data || []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Ministérios</h2>
          <p className="text-muted-foreground">
            Gerencie os ministérios da igreja
          </p>
        </div>
        <Link href="/ministerios/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Ministério
          </Button>
        </Link>
      </div>

      {ministerios.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum ministério cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie o primeiro ministério da sua igreja
            </p>
            <Link href="/ministerios/novo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Ministério
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ministerios.map((ministerio) => (
            <Link key={ministerio.id} href={`/ministerios/${ministerio.id}`}>
              <Card
                className="hover:shadow-lg transition-shadow cursor-pointer h-full"
                style={{ borderColor: ministerio.cor }}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-white text-xl font-bold"
                      style={{ backgroundColor: ministerio.cor }}
                    >
                      {ministerio.nome.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="line-clamp-1">{ministerio.nome}</CardTitle>
                      {ministerio.lider && (
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {ministerio.lider.nome}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {ministerio.descricao && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {ministerio.descricao}
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
