import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const data = searchParams.get("data")
    const igreja_id = searchParams.get("igreja_id")
    const membro_id = searchParams.get("membro_id")

    let query = supabase
      .from("frequencias")
      .select(`
        *,
        membros(nome, foto_url)
      `)

    if (data) query = query.eq("data", data)
    if (igreja_id) query = query.eq("igreja_id", igreja_id)
    if (membro_id) query = query.eq("membro_id", membro_id)

    const { data: frequencias, error } = await query.order("data", { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: frequencias })
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

    // Pode ser um array de frequências (vários membros ao mesmo tempo)
    const frequencias = Array.isArray(body) ? body : [body]

    const frequenciasComUser = frequencias.map(f => ({
      ...f,
      created_by: user.id,
    }))

    const { data, error } = await (supabase as any)
      .from("frequencias")
      .upsert(frequenciasComUser, {
        onConflict: "membro_id,data,tipo_culto",
      })
      .select()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
