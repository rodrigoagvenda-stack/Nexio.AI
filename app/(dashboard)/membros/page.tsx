import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
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
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">
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

  // Status counts
  const ativos    = membros.filter((m) => m.status === "ativo").length
  const inativos  = membros.filter((m) => m.status === "inativo").length
  const visitantes = membros.filter((m) => m.status === "visitante").length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Membros</h1>
            <p className="text-sm text-muted-foreground">
              {membros.length} membro{membros.length !== 1 ? "s" : ""} cadastrado{membros.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link href="/membros/novo">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Membro
          </Button>
        </Link>
      </div>

      {/* Stats strip */}
      {membros.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {ativos} {ativos === 1 ? "ativo" : "ativos"}
          </span>
          {inativos > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              {inativos} {inativos === 1 ? "inativo" : "inativos"}
            </span>
          )}
          {visitantes > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {visitantes} {visitantes === 1 ? "visitante" : "visitantes"}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {membros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
            <Users className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhum membro cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">
            Adicione o primeiro membro da sua igreja para começar a gerenciar sua congregação.
          </p>
          <Link href="/membros/novo">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Primeiro Membro
            </Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <MembrosTable membros={membros} />
        </div>
      )}

    </div>
  )
}
