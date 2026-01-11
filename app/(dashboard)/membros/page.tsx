import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users } from "lucide-react"
import Link from "next/link"
import { MembrosTable } from "@/components/membros/membros-table"
import type { Membro } from "@/types/database.types"

export default async function MembrosPage() {
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

  let membros: any[] = []

  // Buscar membros apenas se o perfil tiver igreja_id e a tabela existir
  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("membros")
      .select(`
        *,
        igrejas:igreja_id (
          nome,
          tipo
        )
      `)
      .eq("igreja_id", profile.igreja_id)
      .order("nome")

    membros = data || []
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Membros</h2>
          <p className="text-muted-foreground">
            Gerencie os membros da sua igreja
          </p>
        </div>
        <Link href="/membros/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Membro
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Membros</CardTitle>
          <CardDescription>
            Todos os membros cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {membros.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum membro cadastrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Adicione o primeiro membro da sua igreja
              </p>
              <Link href="/membros/novo">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Primeiro Membro
                </Button>
              </Link>
            </div>
          ) : (
            <MembrosTable membros={membros} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
