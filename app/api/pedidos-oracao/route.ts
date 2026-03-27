import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { data: profile } = await (supabase as any)
      .from("profiles").select("igreja_id").eq("id", user.id).single()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let query = (supabase as any)
      .from("pedidos_oracao")
      .select(`*, membros(nome, foto_url)`)
      .order("data_pedido", { ascending: false })

    if (profile?.igreja_id) {
      query = query.eq("membros.igreja_id", profile.igreja_id)
    }
    if (status) query = query.eq("status", status)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data: data ?? [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const body = await request.json()

    const { data, error } = await (supabase as any)
      .from("pedidos_oracao")
      .insert({
        membro_id: body.membro_id || null,
        titulo: body.titulo,
        descricao: body.descricao,
        categoria: body.categoria || "outro",
        privacidade: body.privacidade || "lideranca",
        status: "ativo",
        data_pedido: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
