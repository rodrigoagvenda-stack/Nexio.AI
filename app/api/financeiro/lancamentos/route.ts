import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const tipo = searchParams.get("tipo")
    const data_inicio = searchParams.get("data_inicio")
    const data_fim = searchParams.get("data_fim")
    const igreja_id = searchParams.get("igreja_id")

    let query = supabase
      .from("lancamentos_financeiros")
      .select(`
        *,
        categorias_financeiras(nome, tipo, cor),
        contas_bancarias(nome),
        membros(nome)
      `, { count: "exact" })

    if (tipo) query = query.eq("tipo", tipo)
    if (igreja_id) query = query.eq("igreja_id", igreja_id)
    if (data_inicio) query = query.gte("data", data_inicio)
    if (data_fim) query = query.lte("data", data_fim)

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await query
      .range(from, to)
      .order("data", { ascending: false })

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
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Se for parcelado, criar múltiplos lançamentos
    if (body.parcelado && body.numero_parcelas > 1) {
      const lancamentos = []
      const valorParcela = body.valor / body.numero_parcelas

      for (let i = 1; i <= body.numero_parcelas; i++) {
        const dataVencimento = new Date(body.data_vencimento)
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1))

        lancamentos.push({
          ...body,
          valor: valorParcela,
          parcela_atual: i,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          descricao: `${body.descricao} - Parcela ${i}/${body.numero_parcelas}`,
          created_by: user.id,
        })
      }

      const { data, error } = await supabase
        .from("lancamentos_financeiros")
        .insert(lancamentos)
        .select()

      if (error) throw error

      return NextResponse.json({ data })
    }

    // Lançamento único
    const { data, error } = await supabase
      .from("lancamentos_financeiros")
      .insert({
        ...body,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
