import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const igreja_id = searchParams.get("igreja_id")
    const data_inicio = searchParams.get("data_inicio") || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    const data_fim = searchParams.get("data_fim") || new Date().toISOString().split('T')[0]

    if (!igreja_id) {
      return NextResponse.json({ error: "igreja_id é obrigatório" }, { status: 400 })
    }

    // Chamar função SQL para estatísticas
    const { data: stats, error: statsError } = await supabase
      .rpc("estatisticas_financeiras", {
        p_igreja_id: igreja_id,
        p_data_inicio: data_inicio,
        p_data_fim: data_fim,
      })

    if (statsError) throw statsError

    // Buscar saldo das contas
    const { data: contas, error: contasError } = await supabase
      .from("contas_bancarias")
      .select("nome, saldo_atual, tipo")
      .eq("igreja_id", igreja_id)
      .eq("ativo", true)

    if (contasError) throw contasError

    // Buscar lançamentos por categoria para gráfico
    const { data: porCategoria, error: categoriaError } = await supabase
      .from("lancamentos_financeiros")
      .select(`
        valor,
        tipo,
        categorias_financeiras(nome, cor)
      `)
      .eq("igreja_id", igreja_id)
      .gte("data", data_inicio)
      .lte("data", data_fim)
      .eq("status", "efetivado")

    if (categoriaError) throw categoriaError

    // Agrupar por categoria
    const grouped = porCategoria.reduce((acc: any, curr: any) => {
      const categoria = curr.categorias_financeiras.nome
      if (!acc[categoria]) {
        acc[categoria] = {
          nome: categoria,
          cor: curr.categorias_financeiras.cor,
          total: 0,
          tipo: curr.tipo,
        }
      }
      acc[categoria].total += parseFloat(curr.valor)
      return acc
    }, {})

    return NextResponse.json({
      data: {
        stats: stats[0],
        contas,
        por_categoria: Object.values(grouped),
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
