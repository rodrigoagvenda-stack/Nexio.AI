import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const { detalheId, ...fields } = body

    if (!detalheId) {
      return NextResponse.json({ error: "detalheId is required" }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from("escalas_detalhes")
      .update(fields)
      .eq("id", detalheId)
      .eq("escala_id", params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()

    const { data, error } = await (supabase as any)
      .from("escalas_detalhes")
      .insert({
        escala_id: params.id,
        data_culto: body.data_culto,
        dia_semana: body.dia_semana ?? 0,
        horario: body.horario || "",
        tipo_culto: body.tipo_culto || "",
        membro_oracao_id: body.membro_oracao_id || null,
        membro_louvor_id: body.membro_louvor_id || null,
        membro_pregacao_id: body.membro_pregacao_id || null,
        observacoes: body.observacoes || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    let detalheId = searchParams.get("detalheId")

    if (!detalheId) {
      const body = await request.json().catch(() => ({}))
      detalheId = body.detalheId
    }

    if (!detalheId) {
      return NextResponse.json({ error: "detalheId is required" }, { status: 400 })
    }

    const { error } = await (supabase as any)
      .from("escalas_detalhes")
      .delete()
      .eq("id", detalheId)
      .eq("escala_id", params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
