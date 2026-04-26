import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from("profiles").select("igreja_id").eq("id", user.id).single()
  if (!profile?.igreja_id) return NextResponse.json({ data: [] })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  const service = createServiceClient()
  let query = (service as any)
    .from("pedidos_assistencia")
    .select("*, membros(nome)")
    .eq("igreja_id", profile.igreja_id)
    .order("created_at", { ascending: false })

  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { id, status, observacoes } = await req.json()
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 })

  const service = createServiceClient()
  const { error } = await (service as any).from("pedidos_assistencia")
    .update({ status, observacoes: observacoes || null })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
