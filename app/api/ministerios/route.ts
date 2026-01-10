import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Ministerio } from "@/types/database.types"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const igreja_id = searchParams.get("igreja_id")

    let query = supabase
      .from("ministerios")
      .select(`
        *,
        lider:membros(nome),
        igrejas(nome),
        ministerios_membros(count)
      `)

    if (igreja_id) query = query.eq("igreja_id", igreja_id)

    const { data, error } = await query.order("nome")

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
      .from("ministerios")
      .insert(body)
      .select()
      .single<Ministerio>()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
