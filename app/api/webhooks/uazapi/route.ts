import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { sendText, sendButtons, sendList, UazapiConfig, parseWebhookPayload } from "@/lib/uazapi"

// ─── SDR inline (sem chamada HTTP interna) ────────────────────────────────────
async function runSDR(cfg: any, uazapi: UazapiConfig, conversa: any, historico: any[], igrejaNome: string) {
  if (!cfg.openai_api_key) return

  const nome     = conversa.nome_contato || "irmão(ã)"
  const fluxo    = conversa.tipo_fluxo   || "pastoral"
  const assistente = cfg.sdr_nome || "Assistente Missionária Virtual"

  const base = `Você é ${assistente} da ${igrejaNome}. Responda em português, de forma natural e breve (máx 3 frases). Nunca repita o que já disse.`
  let system = base

  if (fluxo === "escala")    system += ` Confirme disponibilidade de ${nome} para servir na escala.`
  if (fluxo === "pastoral")  system += ` Conecte-se pastoralmente com ${nome}. Pergunte como está. Se houver necessidade urgente, inclua ao final (invisível): ALERTA_PASTORAL: categoria=financeiro|casamento|saude|espiritual`
  if (fluxo === "visitante") system += ` ${nome} visitou a igreja. Agradeça e pergunte como foi.`

  const messages = [
    { role: "system", content: system },
    ...historico
      .filter((m: any) => !m.conteudo?.startsWith("[Mensagem"))
      .slice(-20)
      .map((m: any) => ({ role: m.direcao === "saida" ? "assistant" : "user", content: m.conteudo })),
  ]

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.openai_api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.openai_model || "gpt-4o-mini", messages, max_tokens: 400, temperature: 0.75 }),
    signal: AbortSignal.timeout(25000),
  })

  if (!res.ok) { console.error("[SDR] OpenAI error:", res.status); return }

  const json     = await res.json()
  const respostaRaw: string = json.choices?.[0]?.message?.content ?? ""
  if (!respostaRaw) return

  // Extrai alerta interno
  const alertaIdx = respostaRaw.indexOf("ALERTA_PASTORAL:")
  let alerta: string | null = null
  if (alertaIdx !== -1) alerta = respostaRaw.substring(alertaIdx + 16).split("\n")[0].trim()

  const resposta = respostaRaw
    .replace(alertaIdx !== -1 ? respostaRaw.substring(alertaIdx) : "", "")
    .trim()

  // Envia resposta via WhatsApp
  if (resposta) {
    try { await sendText(uazapi, conversa.telefone, resposta) } catch (e) { console.error("[SDR] sendText:", e) }
  }

  // Envia alerta para pastores
  if (alerta) {
    const categoria = alerta.includes("financeiro") ? "financeiro"
      : alerta.includes("casamento") ? "casamento"
      : alerta.includes("saude") ? "saude"
      : "pastoral"

    const numeros: any[] = cfg.numeros_notificacao ?? []
    const destinatarios = numeros.filter((n: any) => n.categoria === "geral" || n.categoria === categoria)
    const alertaMsg = `🚨 *ALERTA PASTORAL*\n\n*Categoria:* ${categoria}\n*Membro:* ${nome}\n*Tel:* ${conversa.telefone}\n*Detalhe:* ${alerta}`

    for (const dest of destinatarios) {
      try { await sendText(uazapi, dest.telefone, alertaMsg) } catch { /* silencioso */ }
    }
  }

  return resposta
}

// ─── Webhook handler ──────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let body: any = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: "JSON inválido" }) }

  // Log completo para debug
  console.log("[webhook/uazapi] FULL BODY:", JSON.stringify(body, null, 2).substring(0, 3000))

  // Filtra eventos que claramente não são mensagens
  const event = (body?.event ?? body?.type ?? "").toLowerCase()
  const ignorar = ["connection", "qr", "status", "presence", "call", "group", "contact", "label", "chat"]
  if (event && ignorar.some(e => event.includes(e))) {
    return NextResponse.json({ ok: true, skipped: event })
  }

  const parsed = parseWebhookPayload(body)
  if (!parsed) {
    console.log("[webhook/uazapi] payload ignorado (fromMe ou sem texto)")
    return NextResponse.json({ ok: true, skipped: "fromMe ou sem texto" })
  }

  const { fromNumber, text, msgId, pushName, instanceName } = parsed
  console.log(`[webhook/uazapi] de=${fromNumber} texto="${text}" inst="${instanceName}"`)

  try {
    const supabase = createServiceClient()

    // Busca todas as igrejas com uazapi configurado
    const { data: igrejas } = await (supabase as any)
      .from("igrejas").select("id, nome, configuracoes")

    if (!igrejas?.length) {
      console.log("[webhook/uazapi] nenhuma igreja encontrada no banco")
      return NextResponse.json({ ok: false, error: "nenhuma igreja" })
    }

    // Tenta encontrar pelo nome da instância, com fallback para qualquer uma com token
    const igrejaCfg =
      igrejas.find((ig: any) =>
        ig.configuracoes?.uazapi_instance &&
        ig.configuracoes.uazapi_instance.toLowerCase() === (instanceName ?? "").toLowerCase()
      ) ??
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_token)

    if (!igrejaCfg) {
      console.log("[webhook/uazapi] nenhuma igreja com uazapi configurado")
      return NextResponse.json({ ok: false, error: "nenhuma igreja configurada" })
    }

    const cfg    = igrejaCfg.configuracoes ?? {}
    const uazapi: UazapiConfig = { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }

    // Busca ou cria conversa
    let { data: conversa } = await (supabase as any)
      .from("conversas_whatsapp")
      .select("id, nome_contato, ia_ativa, tipo_fluxo, nao_lidas")
      .eq("telefone", fromNumber)
      .eq("igreja_id", igrejaCfg.id)
      .neq("status", "encerrada")
      .maybeSingle()

    if (!conversa) {
      const { data: membro } = await (supabase as any)
        .from("membros").select("id, nome")
        .ilike("telefone", `%${fromNumber.slice(-9)}%`)
        .eq("igreja_id", igrejaCfg.id)
        .maybeSingle()

      const nome = membro?.nome ?? pushName ?? fromNumber
      const { data: nova } = await (supabase as any)
        .from("conversas_whatsapp")
        .insert({ igreja_id: igrejaCfg.id, telefone: fromNumber, nome_contato: nome, ia_ativa: true, tipo_fluxo: "pastoral", status: "aberta" })
        .select().single()
      conversa = nova
      conversa._is_new = true
      console.log(`[webhook/uazapi] nova conversa criada: ${nova?.id} — ${nome}`)
    }

    if (!conversa) return NextResponse.json({ ok: false, error: "falha ao criar conversa" })

    // Salva mensagem recebida
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id, direcao: "entrada", conteudo: text,
      tipo: "texto", status: "lido", msg_id_wpp: msgId ?? null,
    })

    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: text,
      ultima_msg_at: new Date().toISOString(),
      nao_lidas: (conversa.nao_lidas ?? 0) + 1,
      status: "aberta",
    }).eq("id", conversa.id)

    // SDR inline se IA ativa
    if (conversa.ia_ativa && uazapi.token) {
      const { data: historico } = await (supabase as any)
        .from("mensagens_whatsapp")
        .select("direcao, conteudo, created_at")
        .eq("conversa_id", conversa.id)
        .order("created_at", { ascending: true })
        .limit(30)

      const isFirstMsg = (historico ?? []).filter((m: any) => m.direcao === "saida").length === 0

      // Primeira interação: envia menu interativo pastoral
      if (isFirstMsg) {
        const nome = conversa.nome_contato || "irmão(ã)"
        try {
          await sendList(uazapi, fromNumber, {
            text: `A paz do Senhor, ${nome}! 😊\n\nSou a assistente virtual da *${igrejaCfg.nome || "nossa Igreja"}*. Que bom ter você aqui!\n\nComo posso ajudar?`,
            listButton: "Ver opções",
            choices: [
              "[Como posso ajudar?]",
              "🙏 Pedido de oração|oracao|Quero pedir intercessão",
              "💰 Ajuda financeira|financeiro|Preciso de apoio",
              "💍 Aconselhamento|casamento|Questões conjugais/familiares",
              "📖 Estudo bíblico|estudo|Quero me aprofundar na Palavra",
              "[Estou bem]",
              "😊 Só passando para dizer oi|bem|Tudo ótimo, obrigado!",
            ],
            footer: "Nossa equipe pastoral está aqui por você",
          })
          const abertura = `[Mensagem interativa de boas-vindas enviada]`
          await (supabase as any).from("mensagens_whatsapp").insert({
            conversa_id: conversa.id, direcao: "saida", conteudo: abertura, ia_gerada: true, status: "enviado",
          })
          await (supabase as any).from("conversas_whatsapp").update({
            ultima_mensagem: "Mensagem de boas-vindas enviada", ultima_msg_at: new Date().toISOString(),
          }).eq("id", conversa.id)
        } catch (e) { console.error("[webhook] opener error:", e) }

      } else if (cfg.openai_api_key) {
        // Mensagens seguintes: OpenAI responde
        const resposta = await runSDR(cfg, uazapi, conversa, historico ?? [], igrejaCfg.nome ?? "Igreja")
        if (resposta) {
          await (supabase as any).from("mensagens_whatsapp").insert({
            conversa_id: conversa.id, direcao: "saida", conteudo: resposta, ia_gerada: true, status: "enviado",
          })
          await (supabase as any).from("conversas_whatsapp").update({
            ultima_mensagem: resposta, ultima_msg_at: new Date().toISOString(),
          }).eq("id", conversa.id)
        }
      }
    }

    return NextResponse.json({ ok: true, conversa_id: conversa.id })
  } catch (e: any) {
    console.error("[webhook/uazapi] erro:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
