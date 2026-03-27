import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const igreja_id = searchParams.get("igreja_id")
    if (!igreja_id) return NextResponse.json({ error: "igreja_id obrigatório" }, { status: 400 })

    // Últimos 6 meses
    const hoje = new Date()
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)
    const data_inicio = inicio.toISOString().split("T")[0]
    const data_fim = hoje.toISOString().split("T")[0]

    const { data, error } = await (supabase as any)
      .from("lancamentos_financeiros")
      .select("data, tipo, valor")
      .eq("igreja_id", igreja_id)
      .eq("status", "efetivado")
      .gte("data", data_inicio)
      .lte("data", data_fim)

    if (error) throw error

    // Agrupar por mês
    const meses: Record<string, { mes: string; entradas: number; saidas: number }> = {}
    const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      meses[key] = { mes: MESES[d.getMonth()], entradas: 0, saidas: 0 }
    }

    for (const l of data ?? []) {
      const key = l.data.substring(0, 7)
      if (meses[key]) {
        if (l.tipo === "entrada") meses[key].entradas += Number(l.valor)
        else meses[key].saidas += Number(l.valor)
      }
    }

    return NextResponse.json({ data: Object.values(meses) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
