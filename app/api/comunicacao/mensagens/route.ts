import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const conversa_id = searchParams.get("conversa_id")
  if (!conversa_id) return NextResponse.json({ error: "conversa_id obrigatório" }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from("mensagens_whatsapp")
    .select("*")
    .eq("conversa_id", conversa_id)
    .order("created_at", { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mark messages as read
  await (supabase as any).from("conversas_whatsapp").update({ nao_lidas: 0 }).eq("id", conversa_id)

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { conversa_id, conteudo, tipo = "texto", ia_gerada = false } = body
  if (!conversa_id || !conteudo) return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  // Get conversation info (telefone + church config)
  const { data: conversa } = await (supabase as any)
    .from("conversas_whatsapp").select("telefone, igreja_id").eq("id", conversa_id).single()
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 })

  // Get uazapi config from church
  const { data: igreja } = await (supabase as any)
    .from("igrejas").select("configuracoes").eq("id", conversa.igreja_id).single()
  const cfg = igreja?.configuracoes ?? {}

  let msgIdWpp: string | null = null
  let sendError: string | null = null

  // Send via uazapi if configured
  if (cfg.uazapi_token && cfg.uazapi_instance) {
    try {
      const baseUrl = (cfg.uazapi_base_url || "https://api.uazapi.io").replace(/\/$/, "")
      const res = await fetch(`${baseUrl}/message/sendText`, {
        method: "POST",
        headers: {
          "apikey": cfg.uazapi_token,
          "Authorization": `Bearer ${cfg.uazapi_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instance: cfg.uazapi_instance, number: conversa.telefone, text: conteudo }),
        signal: AbortSignal.timeout(10000),
      })
      const json = await res.json()
      msgIdWpp = json?.key?.id ?? null
      if (!res.ok) sendError = json?.error ?? "Erro ao enviar via uazapi"
    } catch (e: any) {
      sendError = e.message
    }
  }

  // Persist message regardless
  const { data: msg, error } = await (supabase as any)
    .from("mensagens_whatsapp")
    .insert({
      conversa_id,
      direcao: "saida",
      conteudo,
      tipo,
      ia_gerada,
      msg_id_wpp: msgIdWpp,
      status: sendError ? "falhou" : "enviado",
    })
    .select().single()

  // Update conversation last message
  await (supabase as any).from("conversas_whatsapp").update({
    ultima_mensagem: conteudo,
    ultima_msg_at: new Date().toISOString(),
  }).eq("id", conversa_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: msg, sendError })
}
