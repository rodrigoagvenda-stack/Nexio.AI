import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { sendText, sendMedia, UazapiConfig } from "@/lib/uazapi"

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const conversa_id = searchParams.get("conversa_id")
  if (!conversa_id) return NextResponse.json({ error: "conversa_id obrigatório" }, { status: 400 })

  const service = createServiceClient()
  const { data, error } = await (service as any)
    .from("mensagens_whatsapp")
    .select("*")
    .eq("conversa_id", conversa_id)
    .order("created_at", { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await (service as any).from("conversas_whatsapp").update({ nao_lidas: 0 }).eq("id", conversa_id)
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { conversa_id, conteudo, tipo = "texto", ia_gerada = false, media_url, doc_name } = body

  if (!conversa_id || (!conteudo && !media_url)) {
    return NextResponse.json({ error: "conversa_id e conteudo são obrigatórios" }, { status: 400 })
  }

  // SEMPRE usa service client para bypassar RLS
  const service = createServiceClient()

  const { data: conversa } = await (service as any)
    .from("conversas_whatsapp").select("telefone, igreja_id").eq("id", conversa_id).single()
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 })

  const { data: igData } = await (service as any)
    .from("igrejas").select("configuracoes").eq("id", conversa.igreja_id).single()
  const cfg = igData?.configuracoes ?? {}

  let sendError: string | null = null
  let msgIdWpp: string | null = null

  if (cfg.uazapi_token && cfg.uazapi_base_url) {
    const uazapi: UazapiConfig = { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }
    try {
      let res: any
      if (media_url && tipo === "audio") {
        res = await sendMedia(uazapi, conversa.telefone, { type: "ptt", file: media_url })
      } else if (media_url && tipo === "imagem") {
        res = await sendMedia(uazapi, conversa.telefone, { type: "image", file: media_url, text: conteudo || "" })
      } else if (media_url && tipo === "video") {
        res = await sendMedia(uazapi, conversa.telefone, { type: "video", file: media_url, text: conteudo || "" })
      } else if (media_url && tipo === "documento") {
        res = await sendMedia(uazapi, conversa.telefone, { type: "document", file: media_url, text: conteudo || "", docName: doc_name })
      } else {
        res = await sendText(uazapi, conversa.telefone, conteudo)
      }
      msgIdWpp = res?.key?.id ?? res?.id ?? null
    } catch (e: any) {
      sendError = e.message
    }
  }

  const texto = conteudo || (media_url ? `[${tipo}]` : "")

  const { data: msg, error } = await (service as any)
    .from("mensagens_whatsapp")
    .insert({ conversa_id, direcao: "saida", conteudo: texto, tipo, ia_gerada, msg_id_wpp: msgIdWpp, status: sendError ? "falhou" : "enviado" })
    .select().single()

  await (service as any).from("conversas_whatsapp").update({
    ultima_mensagem: texto, ultima_msg_at: new Date().toISOString(),
  }).eq("id", conversa_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: msg, sendError })
}
