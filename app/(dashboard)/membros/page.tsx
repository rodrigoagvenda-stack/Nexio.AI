import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Users } from "lucide-react"
import Link from "next/link"

export default async function MembrosPage() {
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum membro cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Execute o schema completo do banco para criar a tabela de membros
            </p>
            <Link href="/membros/novo">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Primeiro Membro
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
