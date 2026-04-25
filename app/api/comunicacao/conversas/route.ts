import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from("profiles").select("igreja_id").eq("id", user.id).single()
  if (!profile?.igreja_id) return NextResponse.json({ data: [] })

  const { data, error } = await (supabase as any)
    .from("conversas_whatsapp")
    .select("*, contatos(id, nome, foto_url, tipo, membro_id)")
    .eq("igreja_id", profile.igreja_id)
    .order("ultima_msg_at", { ascending: false, nullsFirst: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from("profiles").select("igreja_id").eq("id", user.id).single()
  if (!profile?.igreja_id) return NextResponse.json({ error: "Perfil sem igreja" }, { status: 400 })

  const body = await req.json()
  const { telefone, nome, tipo = "membro", membro_id, tipo_fluxo } = body

  if (!telefone || !nome) return NextResponse.json({ error: "telefone e nome obrigatórios" }, { status: 400 })

  // Upsert contato
  let contatoId: string | null = null
  const { data: contatoExistente } = await (supabase as any)
    .from("contatos").select("id").eq("telefone", telefone).eq("igreja_id", profile.igreja_id).single()

  if (contatoExistente) {
    contatoId = contatoExistente.id
  } else {
    const { data: novoContato } = await (supabase as any)
      .from("contatos").insert({ igreja_id: profile.igreja_id, nome, telefone, tipo, membro_id: membro_id || null }).select("id").single()
    contatoId = novoContato?.id ?? null
  }

  // Check for existing conversation
  const { data: convExistente } = await (supabase as any)
    .from("conversas_whatsapp").select("id").eq("telefone", telefone).eq("igreja_id", profile.igreja_id)
    .neq("status", "encerrada").single()

  if (convExistente) return NextResponse.json({ data: convExistente })

  const { data, error } = await (supabase as any)
    .from("conversas_whatsapp")
    .insert({ igreja_id: profile.igreja_id, contato_id: contatoId, telefone, nome_contato: nome, tipo_fluxo: tipo_fluxo || null })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
