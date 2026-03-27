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

    // Verifica se já existe escala para esse mês/ano/igreja
    const { data: existente } = await (supabase as any)
      .from("escalas")
      .select("id")
      .eq("mes", mes)
      .eq("ano", ano)
      .eq("igreja_id", igreja_id)
      .single()

    if (existente?.id) {
      // Verifica se tem cultos (detalhes)
      const { count } = await (supabase as any)
        .from("escalas_detalhes")
        .select("id", { count: "exact", head: true })
        .eq("escala_id", existente.id)

      if (count && count > 0) {
        // Já tem cultos — apenas redireciona para ela
        const { data: escala } = await (supabase as any)
          .from("escalas")
          .select("id, mes, ano, status, data_geracao, igreja_id")
          .eq("id", existente.id)
          .single()
        return NextResponse.json({ data: escala, message: "Escala já existe com cultos." })
      }

      // Está vazia — deleta para poder gerar nova
      await (supabase as any).from("escalas").delete().eq("id", existente.id)
    }

    // Gerar nova escala via função SQL
    const { data: novaId, error } = await (supabase as any).rpc("gerar_escala_automatica", {
      p_mes: mes,
      p_ano: ano,
      p_igreja_id: igreja_id,
      p_created_by: user.id,
    })

    if (error) throw error

    const { data: escala, error: escalaError } = await (supabase as any)
      .from("escalas")
      .select("id, mes, ano, status, data_geracao, igreja_id")
      .eq("id", novaId)
      .single()

    if (escalaError) throw escalaError

    return NextResponse.json({ data: escala, message: "Escala gerada com sucesso!" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
