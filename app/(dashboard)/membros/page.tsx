import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import Link from "next/link"
import { MembrosTable } from "@/components/membros/membros-table"

export default async function MembrosPage() {
  const supabase = await createClient()

  const { data: membros } = await supabase
    .from("membros")
    .select(`
      *,
      igrejas(nome)
    `)
    .order("nome")
    .limit(50)

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
          <MembrosTable membros={membros || []} />
        </CardContent>
      </Card>
    </div>
  )
}
