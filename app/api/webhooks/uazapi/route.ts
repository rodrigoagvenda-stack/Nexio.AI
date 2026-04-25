import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Webhook receiver for uazapi incoming messages
// Configure in uazapi dashboard: POST https://your-domain/api/webhooks/uazapi
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    // uazapi webhook format
    const event = body?.event || body?.type
    if (event !== "messages.upsert" && event !== "message") {
      return NextResponse.json({ ok: true, skipped: true })
    }

    const msg = body?.data?.message || body?.message || body
    const fromNumber: string = msg?.key?.remoteJid?.replace("@s.whatsapp.net", "")
      ?? body?.from?.replace("@s.whatsapp.net", "")
    const texto: string = msg?.message?.conversation
      ?? msg?.message?.extendedTextMessage?.text
      ?? body?.body
      ?? ""
    const instanceId: string = body?.instance ?? body?.instanceId ?? ""

    if (!fromNumber || !texto) return NextResponse.json({ ok: true, skipped: true })

    // Find the church by uazapi instance
    const { data: igrejas } = await (supabase as any)
      .from("igrejas")
      .select("id, nome, configuracoes")

    const igreja = (igrejas ?? []).find((ig: any) =>
      ig.configuracoes?.uazapi_instance === instanceId
    )
    if (!igreja) return NextResponse.json({ ok: true, no_match: true })

    // Find or create conversation
    let { data: conversa } = await (supabase as any)
      .from("conversas_whatsapp")
      .select("id, contato_id, ia_ativa, tipo_fluxo")
      .eq("telefone", fromNumber)
      .eq("igreja_id", igreja.id)
      .neq("status", "encerrada")
      .single()

    if (!conversa) {
      // Try to find member by phone
      const { data: membro } = await (supabase as any)
        .from("membros")
        .select("id, nome")
        .eq("telefone", fromNumber)
        .eq("igreja_id", igreja.id)
        .single()

      const nome = membro?.nome ?? fromNumber
      const { data: novaConversa } = await (supabase as any)
        .from("conversas_whatsapp")
        .insert({ igreja_id: igreja.id, telefone: fromNumber, nome_contato: nome, ia_ativa: false })
        .select().single()
      conversa = novaConversa
    }

    if (!conversa) return NextResponse.json({ ok: true, error: "Falha ao criar conversa" })

    // Save incoming message
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id,
      direcao: "entrada",
      conteudo: texto,
      tipo: "texto",
      status: "lido",
    })

    // Update conversation
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: texto,
      ultima_msg_at: new Date().toISOString(),
      nao_lidas: (conversa.nao_lidas ?? 0) + 1,
      status: "aberta",
    }).eq("id", conversa.id)

    // If IA is active, trigger SDR response
    if (conversa.ia_ativa) {
      const { data: historico } = await (supabase as any)
        .from("mensagens_whatsapp")
        .select("direcao, conteudo")
        .eq("conversa_id", conversa.id)
        .order("created_at", { ascending: true })
        .limit(30)

      const sdrRes = await fetch(`${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/comunicacao/sdr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversa_id: conversa.id,
          historico: historico ?? [],
          fluxo: conversa.tipo_fluxo || "pastoral",
          contexto: { nome_membro: conversa.nome_contato },
        }),
      })

      if (sdrRes.ok) {
        const { resposta } = await sdrRes.json()
        if (resposta) {
          const cfg = igreja.configuracoes ?? {}
          const baseUrl = cfg.uazapi_base_url || "https://api.uazapi.io"
          await fetch(`${baseUrl}/message/sendText`, {
            method: "POST",
            headers: { "apikey": cfg.uazapi_token, "Authorization": `Bearer ${cfg.uazapi_token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ instance: cfg.uazapi_instance, number: fromNumber, text: resposta }),
            signal: AbortSignal.timeout(10000),
          })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("[webhook/uazapi]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
