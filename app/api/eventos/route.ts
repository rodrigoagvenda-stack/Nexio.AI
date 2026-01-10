import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const igreja_id = searchParams.get("igreja_id")
    const upcoming = searchParams.get("upcoming") === "true"

    let query = supabase
      .from("eventos")
      .select(`
        *,
        igrejas(nome),
        responsavel:membros(nome),
        eventos_inscricoes(count)
      `)

    if (igreja_id) query = query.eq("igreja_id", igreja_id)
    if (upcoming) query = query.gte("data_inicio", new Date().toISOString().split('T')[0])

    const { data, error } = await query.order("data_inicio", { ascending: true })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await supabase
      .from("eventos")
      .insert(body)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
