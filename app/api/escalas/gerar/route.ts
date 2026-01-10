import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { mes, ano, igreja_id } = await request.json()

    // Chamar função SQL para gerar escala automaticamente
    const { data, error } = await supabase.rpc("gerar_escala_automatica", {
      p_mes: mes,
      p_ano: ano,
      p_igreja_id: igreja_id,
      p_created_by: user.id,
    })

    if (error) throw error

    // Buscar escala gerada com detalhes
    const { data: escala, error: escalaError } = await supabase
      .from("escalas")
      .select(`
        *,
        escalas_detalhes(
          *,
          membro_oracao:membros!membro_oracao_id(id, nome, telefone),
          membro_louvor:membros!membro_louvor_id(id, nome, telefone),
          membro_pregacao:membros!membro_pregacao_id(id, nome, telefone),
          membro_som:membros!membro_som_id(id, nome, telefone),
          membro_recepcao:membros!membro_recepcao_id(id, nome, telefone)
        )
      `)
      .eq("id", data)
      .single() as any

    if (escalaError) throw escalaError

    return NextResponse.json({
      data: escala,
      message: "Escala gerada com sucesso!"
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
