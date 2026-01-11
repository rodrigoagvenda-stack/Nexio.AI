import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, MessageSquare } from "lucide-react"
import Link from "next/link"

export default async function ComunicacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Comunicação</h2>
          <p className="text-muted-foreground">
            Envie mensagens para os membros
          </p>
        </div>
        <Link href="/comunicacao/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Mensagem
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma mensagem enviada</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Comece a se comunicar com os membros da igreja
          </p>
          <Link href="/comunicacao/nova">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Enviar Primeira Mensagem
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
