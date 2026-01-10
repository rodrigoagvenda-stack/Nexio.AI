import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Igreja } from "@/types/database.types"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("igrejas")
      .select(`
        *,
        responsavel:profiles(nome, email)
      `)
      .order("nome")

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

    const { data, error} = await (supabase as any)
      .from("igrejas")
      .insert(body)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
