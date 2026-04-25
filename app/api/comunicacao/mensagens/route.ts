import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendText, sendButtons, sendList, sendPoll, sendMedia, UazapiConfig } from "@/lib/uazapi"

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

  await (supabase as any).from("conversas_whatsapp").update({ nao_lidas: 0 }).eq("id", conversa_id)

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const {
    conversa_id, conteudo, tipo = "texto", ia_gerada = false,
    // Campos extras para tipos interativos
    choices, footer, list_button, selectable_count, image_url,
    // Mídia
    media_url, doc_name,
  } = body

  if (!conversa_id || !conteudo) return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  const { data: conversa } = await (supabase as any)
    .from("conversas_whatsapp").select("telefone, igreja_id").eq("id", conversa_id).single()
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 })

  const { data: igreja } = await (supabase as any)
    .from("igrejas").select("configuracoes").eq("id", conversa.igreja_id).single()
  const cfg = igreja?.configuracoes ?? {}

  let sendError: string | null = null
  let msgIdWpp: string | null = null

  if (cfg.uazapi_token && cfg.uazapi_base_url) {
    const uazapi: UazapiConfig = { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }
    const number: string = conversa.telefone

    try {
      let res: any
      if (tipo === "botoes" && choices?.length) {
        res = await sendButtons(uazapi, number, { text: conteudo, choices, footer, image: image_url })
      } else if (tipo === "lista" && choices?.length) {
        res = await sendList(uazapi, number, { text: conteudo, listButton: list_button || "Ver opções", choices, footer })
      } else if (tipo === "enquete" && choices?.length) {
        res = await sendPoll(uazapi, number, { text: conteudo, choices, selectableCount: selectable_count })
      } else if (tipo === "imagem" && media_url) {
        res = await sendMedia(uazapi, number, { type: "image", file: media_url, text: conteudo })
      } else if (tipo === "documento" && media_url) {
        res = await sendMedia(uazapi, number, { type: "document", file: media_url, text: conteudo, docName: doc_name })
      } else {
        // padrão: texto simples
        res = await sendText(uazapi, number, conteudo)
      }
      msgIdWpp = res?.key?.id ?? res?.id ?? null
    } catch (e: any) {
      sendError = e.message
    }
  }

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
      metadata: choices ? { choices, footer, list_button } : {},
    })
    .select().single()

  await (supabase as any).from("conversas_whatsapp").update({
    ultima_mensagem: conteudo,
    ultima_msg_at: new Date().toISOString(),
  }).eq("id", conversa_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: msg, sendError })
}
