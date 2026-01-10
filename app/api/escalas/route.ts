import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Escala } from "@/types/database.types"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const igreja_id = searchParams.get("igreja_id")
    const ano = searchParams.get("ano")
    const mes = searchParams.get("mes")

    let query = supabase
      .from("escalas")
      .select(`
        *,
        igrejas(nome),
        profiles(nome)
      `)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })

    if (igreja_id) query = query.eq("igreja_id", igreja_id)
    if (ano) query = query.eq("ano", parseInt(ano))
    if (mes) query = query.eq("mes", parseInt(mes))

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    const { data, error } = await supabase
      .from("escalas")
      .insert({
        ...body,
        created_by: user.id,
      })
      .select()
      .single<Escala>()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
