import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from("profiles").select("igreja_id").eq("id", user.id).single()
  if (!profile?.igreja_id) return NextResponse.json({ error: "Sem igreja" }, { status: 400 })

  const service = createServiceClient()
  const { data: ig, error } = await (service as any)
    .from("igrejas").select("id, nome, configuracoes").eq("id", profile.igreja_id).single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: ig })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from("profiles").select("igreja_id, role").eq("id", user.id).single()
  if (!profile?.igreja_id) return NextResponse.json({ error: "Sem igreja" }, { status: 400 })
  if (!["admin","pastor"].includes(profile.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 })

  const { configuracoes } = await req.json()

  const service = createServiceClient()
  const { error } = await (service as any)
    .from("igrejas").update({ configuracoes }).eq("id", profile.igreja_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
