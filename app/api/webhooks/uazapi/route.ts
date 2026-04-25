import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendText, UazapiConfig, parseWebhookPayload } from "@/lib/uazapi"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const supabase = await createClient()

    // Ignora eventos que não são mensagens recebidas
    const event: string = body?.event ?? body?.type ?? ""
    if (event && !event.includes("message")) {
      return NextResponse.json({ ok: true, skipped: event })
    }

    const parsed = parseWebhookPayload(body)
    if (!parsed) return NextResponse.json({ ok: true, skipped: "fromMe ou sem texto" })

    const { fromNumber, text, msgId, pushName, instanceName } = parsed

    // Encontra a igreja pela instância uazapi
    const { data: igrejas } = await (supabase as any)
      .from("igrejas").select("id, nome, configuracoes")

    const igreja = (igrejas ?? []).find((ig: any) => {
      const instSalva: string = ig.configuracoes?.uazapi_instance ?? ""
      return (
        instSalva === instanceName ||
        instSalva.toLowerCase() === (instanceName ?? "").toLowerCase() ||
        // fallback: se há só uma igreja configurada com token, usa ela
        (ig.configuracoes?.uazapi_token && !instanceName)
      )
    })

    // Se não achou por nome, tenta pelo token (quando uazapi não manda instanceName)
    const igrejaCfg = igreja ?? (igrejas ?? []).find((ig: any) => ig.configuracoes?.uazapi_token)
    if (!igrejaCfg) return NextResponse.json({ ok: true, no_match: true })

    const uazapi: UazapiConfig | null = igrejaCfg.configuracoes?.uazapi_token && igrejaCfg.configuracoes?.uazapi_base_url
      ? { base_url: igrejaCfg.configuracoes.uazapi_base_url, token: igrejaCfg.configuracoes.uazapi_token }
      : null

    // Busca conversa existente (aberta)
    let { data: conversa } = await (supabase as any)
      .from("conversas_whatsapp")
      .select("id, nome_contato, ia_ativa, tipo_fluxo, nao_lidas")
      .eq("telefone", fromNumber)
      .eq("igreja_id", igrejaCfg.id)
      .neq("status", "encerrada")
      .maybeSingle()

    // Cria conversa se não existir
    if (!conversa) {
      // Tenta identificar membro pelo telefone
      const { data: membro } = await (supabase as any)
        .from("membros").select("id, nome")
        .eq("telefone", fromNumber).eq("igreja_id", igrejaCfg.id).maybeSingle()

      const nome = membro?.nome ?? pushName ?? fromNumber
      const { data: novaConversa } = await (supabase as any)
        .from("conversas_whatsapp")
        .insert({ igreja_id: igrejaCfg.id, telefone: fromNumber, nome_contato: nome, ia_ativa: false, status: "aberta" })
        .select().single()
      conversa = novaConversa
    }

    if (!conversa) return NextResponse.json({ ok: false, error: "Falha ao criar conversa" })

    // Salva mensagem recebida
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id,
      direcao: "entrada",
      conteudo: text,
      tipo: "texto",
      status: "lido",
      msg_id_wpp: msgId ?? null,
    })

    // Atualiza conversa
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: text,
      ultima_msg_at: new Date().toISOString(),
      nao_lidas: (conversa.nao_lidas ?? 0) + 1,
      status: "aberta",
    }).eq("id", conversa.id)

    // Se IA ativa, gera resposta via SDR
    if (conversa.ia_ativa && uazapi) {
      const { data: historico } = await (supabase as any)
        .from("mensagens_whatsapp")
        .select("direcao, conteudo")
        .eq("conversa_id", conversa.id)
        .order("created_at", { ascending: true })
        .limit(30)

      const appUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? process.env.NEXTAUTH_URL
        ?? "http://localhost:3000"

      try {
        const sdrRes = await fetch(`${appUrl}/api/comunicacao/sdr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversa_id: conversa.id,
            historico: historico ?? [],
            fluxo: conversa.tipo_fluxo || "pastoral",
            contexto: { nome_membro: conversa.nome_contato },
          }),
        })
        // Resposta já é enviada diretamente pelo SDR via uazapi
        if (!sdrRes.ok) {
          const err = await sdrRes.json().catch(() => ({}))
          console.error("[webhook] SDR error:", err)
        }
      } catch (e) {
        console.error("[webhook] SDR call failed:", e)
      }
    }

    return NextResponse.json({ ok: true, conversa_id: conversa.id })
  } catch (e: any) {
    console.error("[webhook/uazapi]", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
