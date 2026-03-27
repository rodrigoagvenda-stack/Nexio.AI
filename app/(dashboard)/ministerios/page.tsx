import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Layers, Plus, User } from "lucide-react"
import Link from "next/link"

export default async function MinisteriosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 border border-purple-100">
            <Layers className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ministérios</h1>
            <p className="text-sm text-muted-foreground">
              {ministerios.length === 0
                ? "Nenhum ministério ativo"
                : `${ministerios.length} ministério${ministerios.length !== 1 ? "s" : ""} ativo${ministerios.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <Link href="/ministerios/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Ministério
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {ministerios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-5">
            <Layers className="h-9 w-9 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nenhum ministério cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">
            Crie o primeiro ministério da sua igreja para organizar os grupos e equipes.
          </p>
          <Link href="/ministerios/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Ministério
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ministerios.map((ministerio) => {
            const cor = ministerio.cor || "#6b7280"
            const inicial = ministerio.nome?.charAt(0)?.toUpperCase() ?? "?"

            return (
              <Link key={ministerio.id} href={`/ministerios/${ministerio.id}`}>
                <div
                  className="group rounded-xl border bg-card border-l-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full flex flex-col overflow-hidden"
                  style={{ borderLeftColor: cor }}
                >
                  <div className="p-4 flex flex-col flex-1">
                    {/* Header row: initial box + name + leader */}
                    <div className="flex items-start gap-3">
                      <div
                        className="h-11 w-11 rounded-lg flex items-center justify-center text-white text-xl font-bold shrink-0"
                        style={{ backgroundColor: cor }}
                      >
                        {inicial}
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="font-bold text-card-foreground leading-snug line-clamp-1">
                          {ministerio.nome}
                        </h3>
                        {ministerio.lider ? (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <User className="h-3 w-3 shrink-0" />
                            <span className="line-clamp-1">{ministerio.lider.nome}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">Sem líder definido</p>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {ministerio.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-3 flex-1">
                        {ministerio.descricao}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: cor }}
                      />
                      <span className="text-xs text-muted-foreground font-medium">Ativo</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
