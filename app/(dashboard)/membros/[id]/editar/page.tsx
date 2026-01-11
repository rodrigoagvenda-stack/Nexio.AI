import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { MembroEditForm } from "@/components/membros/membro-edit-form"

interface PageProps {
  params: {
    id: string
  }
}

export default async function MembroEditPage({ params }: PageProps) {
  const supabase = await createClient()

  // Buscar membro
  const { data: membro, error } = await (supabase as any)
    .from("membros")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !membro) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Editar Membro</h2>
        <p className="text-muted-foreground">
          Atualize as informações do membro
        </p>
      </div>

      <MembroEditForm membro={membro} />
    </div>
  )
}
