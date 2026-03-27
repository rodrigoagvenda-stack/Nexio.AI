import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Plus, Users } from "lucide-react"
import Link from "next/link"
import { MembrosTable } from "@/components/membros/membros-table"

export default async function MembrosPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles").select("igreja_id").eq("id", user.id).single()

  let membros: any[] = []
  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("membros")
      .select("*, igrejas:igreja_id(nome, tipo)")
      .eq("igreja_id", profile.igreja_id)
      .order("nome")
    membros = data || []
  }

  const ativos    = membros.filter((m) => m.status === "ativo").length
  const inativos  = membros.filter((m) => m.status === "inativo").length
  const visitantes = membros.filter((m) => m.status === "visitante").length

  return (
    <div className="space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Membros</h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {ativos} ativos
            </span>
            {inativos > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                {inativos} inativos
              </span>
            )}
            {visitantes > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                {visitantes} visitantes
              </span>
            )}
          </div>
        </div>
        <Link href="/membros/novo">
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Membro
          </Button>
        </Link>
      </div>

      {membros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">Nenhum membro cadastrado</p>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Adicione o primeiro membro para começar a gerenciar a congregação.
          </p>
          <Link href="/membros/novo">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Primeiro Membro
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <MembrosTable membros={membros} />
        </div>
      )}

    </div>
  )
}
