import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Membro } from "@/types/database.types"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "10")
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || ""
    const igreja_id = searchParams.get("igreja_id") || ""

    let query = supabase
      .from("membros")
      .select("*, igrejas(nome)", { count: "exact" })

    if (search) {
      query = query.ilike("nome", `%${search}%`)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (igreja_id) {
      query = query.eq("igreja_id", igreja_id)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await query
      .range(from, to)
      .order("nome")

    if (error) throw error

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { data, error } = await (supabase as any)
      .from("membros")
      .insert(body)
      .select()
      .single()

    if (error) throw error

    // Inserir funções do membro
    if (body.funcoes && body.funcoes.length > 0) {
      const funcoes = body.funcoes.map((f: any) => ({
        membro_id: data.id,
        funcao: f.funcao,
        nivel: f.nivel,
      }))

      await (supabase as any).from("membros_funcoes").insert(funcoes)
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
