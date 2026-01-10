import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("membros")
      .select(`
        *,
        igrejas(nome, tipo),
        membros_funcoes(funcao, nivel, ativo)
      `)
      .eq("id", params.id)
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { funcoes, ...membroData } = body

    const { data, error } = await supabase
      .from("membros")
      .update(membroData)
      .eq("id", params.id)
      .select()
      .single()

    if (error) throw error

    // Atualizar funções
    if (funcoes) {
      // Deletar funções antigas
      await supabase
        .from("membros_funcoes")
        .delete()
        .eq("membro_id", params.id)

      // Inserir novas funções
      if (funcoes.length > 0) {
        const novasFuncoes = funcoes.map((f: any) => ({
          membro_id: params.id,
          funcao: f.funcao,
          nivel: f.nivel,
        }))

        await supabase.from("membros_funcoes").insert(novasFuncoes)
      }
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Soft delete - apenas marca como inativo
    const { error } = await supabase
      .from("membros")
      .update({ status: "inativo" })
      .eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ message: "Membro desativado com sucesso" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
