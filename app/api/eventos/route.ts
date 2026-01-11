import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Evento } from "@/types/database.types"

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

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      )
    }

    // Buscar perfil do usuário para obter igreja_id
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("igreja_id")
      .eq("id", user.id)
      .single()

    if (!profile?.igreja_id) {
      return NextResponse.json(
        { error: "Usuário não possui igreja associada" },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Adicionar igreja_id do usuário logado
    const eventoData = {
      ...body,
      igreja_id: profile.igreja_id,
    }

    const { data, error } = await (supabase as any)
      .from("eventos")
      .insert(eventoData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
