import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const igreja_id = searchParams.get("igreja_id")
    if (!igreja_id) return NextResponse.json({ error: "igreja_id obrigatório" }, { status: 400 })

    const { data, error } = await (supabase as any)
      .from("cultos_regulares")
      .select("*")
      .eq("igreja_id", igreja_id)
      .eq("ativo", true)
      .order("dia_semana")
      .order("horario")

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Replaces all cultos for a church (upsert)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { igreja_id, cultos } = await request.json()
    if (!igreja_id) return NextResponse.json({ error: "igreja_id obrigatório" }, { status: 400 })

    // Delete existing, then insert new
    await (supabase as any).from("cultos_regulares").delete().eq("igreja_id", igreja_id)

    if (cultos && cultos.length > 0) {
      const rows = cultos.map((c: any) => ({
        id: crypto.randomUUID(),
        igreja_id,
        nome: c.nome,
        dia_semana: c.dia_semana,
        horario: c.horario,
        tipo: c.tipo || "semana",
        ativo: true,
      }))
      const { error } = await (supabase as any).from("cultos_regulares").insert(rows)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
