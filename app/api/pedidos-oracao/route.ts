import { createClient, createServiceClient } from "@/lib/supabase/server"
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

    // Usa service client para bypassar RLS
    const service = createServiceClient()

    // Busca IDs dos membros desta igreja
    let membrosIds: string[] = []
    if (profile?.igreja_id) {
      const { data: mbs } = await (service as any)
        .from("membros").select("id").eq("igreja_id", profile.igreja_id)
      membrosIds = (mbs ?? []).map((m: any) => m.id)
    }

    // Busca pedidos: dos membros da igreja OU sem membro (vindos do SDR via WhatsApp)
    let query = (service as any)
      .from("pedidos_oracao")
      .select(`*, membros(nome, foto_url)`)
      .order("data_pedido", { ascending: false })

    if (membrosIds.length > 0) {
      query = query.or(`membro_id.in.(${membrosIds.join(",")}),membro_id.is.null`)
    } else {
      // Sem membros cadastrados — mostra todos os sem membro (SDR)
      query = query.is("membro_id", null)
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
