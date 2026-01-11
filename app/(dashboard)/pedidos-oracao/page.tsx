import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Heart } from "lucide-react"
import Link from "next/link"

export default async function PedidosOracaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pedidos de Oração</h2>
          <p className="text-muted-foreground">
            Gerencie os pedidos de oração da igreja
          </p>
        </div>
        <Link href="/pedidos-oracao/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pedido
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Heart className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum pedido de oração</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comece a registrar os pedidos de oração da igreja
          </p>
          <Link href="/pedidos-oracao/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Primeiro Pedido
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
