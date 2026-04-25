import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { sendText, sendList, UazapiConfig, parseWebhookPayload } from "@/lib/uazapi"

// ─── SDR ──────────────────────────────────────────────────────────────────────
async function runSDR(cfg: any, uazapi: UazapiConfig, conversa: any, historico: any[], igrejaNome: string) {
  if (!cfg.openai_api_key) { console.log("[SDR] sem openai_api_key"); return }

  const nome      = conversa.nome_contato || "irmão(ã)"
  const assistente = cfg.sdr_nome || "Assistente Missionária Virtual"
  const system    = `Você é ${assistente} da ${igrejaNome}. Responda em português, de forma natural e acolhedora (máx 3 frases). Nunca repita o que já disse. Conecte-se pastoralmente com ${nome} — pergunte como está a vida, família e fé. Se identificar necessidade urgente inclua ao final (invisível ao usuário): ALERTA_PASTORAL: categoria=financeiro|casamento|saude|espiritual`

  const messages = [
    { role: "system", content: system },
    ...historico
      .filter((m: any) => !m.conteudo?.startsWith("["))
      .slice(-20)
      .map((m: any) => ({ role: m.direcao === "saida" ? "assistant" : "user", content: m.conteudo })),
  ]

  console.log("[SDR] chamando OpenAI, historico msgs:", messages.length)

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.openai_api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.openai_model || "gpt-4o-mini", messages, max_tokens: 400, temperature: 0.75 }),
    signal: AbortSignal.timeout(25000),
  })

  if (!res.ok) { console.error("[SDR] OpenAI status:", res.status, await res.text().catch(() => "")); return }

  const respostaRaw: string = (await res.json()).choices?.[0]?.message?.content ?? ""
  console.log("[SDR] resposta:", respostaRaw.substring(0, 100))

  const alertaIdx = respostaRaw.indexOf("ALERTA_PASTORAL:")
  const alerta    = alertaIdx !== -1 ? respostaRaw.substring(alertaIdx + 16).split("\n")[0].trim() : null
  const resposta  = respostaRaw.replace(alertaIdx !== -1 ? respostaRaw.substring(alertaIdx) : "", "").trim()

  if (resposta) {
    try { await sendText(uazapi, conversa.telefone, resposta) }
    catch (e) { console.error("[SDR] sendText erro:", e) }
  }

  if (alerta) {
    const categoria = alerta.includes("financeiro") ? "financeiro" : alerta.includes("casamento") ? "casamento" : alerta.includes("saude") ? "saude" : "pastoral"
    const alertaMsg = `🚨 *ALERTA PASTORAL*\n\n*Categoria:* ${categoria}\n*Membro:* ${nome}\n*Tel:* ${conversa.telefone}\n*Detalhe:* ${alerta}`
    for (const dest of (cfg.numeros_notificacao ?? []).filter((n: any) => n.categoria === "geral" || n.categoria === categoria)) {
      try { await sendText(uazapi, dest.telefone, alertaMsg) } catch { /* silencioso */ }
    }
  }

  return resposta
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  let body: any = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  // Log compacto — só o essencial (sem dumpear o body inteiro)
  const eventType = body?.EventType ?? body?.event ?? body?.type ?? ""
  console.log(`[webhook] EventType="${eventType}" instance="${body?.instanceName ?? ""}"`)

  // Ignora eventos não relacionados a mensagens
  if (eventType && !eventType.toLowerCase().includes("message")) {
    return NextResponse.json({ ok: true, skipped: eventType })
  }

  const parsed = parseWebhookPayload(body)
  if (!parsed) {
    console.log("[webhook] ignorado — fromMe ou sem texto")
    return NextResponse.json({ ok: true })
  }

  const { fromNumber, text, msgId, pushName, instanceName } = parsed
  console.log(`[webhook] de=${fromNumber} texto="${text.substring(0, 50)}"`)

  try {
    const supabase = createServiceClient()

    // Busca igrejas configuradas
    const { data: igrejas, error: igError } = await (supabase as any)
      .from("igrejas").select("id, nome, configuracoes")
    console.log(`[webhook] igrejas no banco: ${igrejas?.length ?? 0}`, igError?.message ?? "")

    if (!igrejas?.length) return NextResponse.json({ ok: false, error: "nenhuma igreja" })

    const igrejaCfg =
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_instance?.toLowerCase() === (instanceName ?? "").toLowerCase()) ??
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_token)

    if (!igrejaCfg) { console.log("[webhook] nenhuma igreja com token"); return NextResponse.json({ ok: false }) }

    const cfg    = igrejaCfg.configuracoes ?? {}
    const uazapi: UazapiConfig = { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }

    console.log(`[webhook] igreja: ${igrejaCfg.nome} | uazapi url: ${cfg.uazapi_base_url ? "ok" : "MISSING"} | token: ${cfg.uazapi_token ? "ok" : "MISSING"} | openai: ${cfg.openai_api_key ? "ok" : "MISSING"}`)

    // Busca conversa existente
    let { data: conversa } = await (supabase as any)
      .from("conversas_whatsapp")
      .select("id, nome_contato, ia_ativa, tipo_fluxo, nao_lidas, telefone")
      .eq("telefone", fromNumber)
      .eq("igreja_id", igrejaCfg.id)
      .neq("status", "encerrada")
      .maybeSingle()

    let isNew = false

    if (!conversa) {
      // Tenta encontrar membro pelo telefone (últimos 9 dígitos)
      const { data: membro } = await (supabase as any)
        .from("membros").select("id, nome")
        .ilike("telefone", `%${fromNumber.slice(-9)}%`)
        .eq("igreja_id", igrejaCfg.id).maybeSingle()

      const nome = membro?.nome ?? pushName ?? fromNumber
      const { data: nova, error: novaErr } = await (supabase as any)
        .from("conversas_whatsapp")
        .insert({ igreja_id: igrejaCfg.id, telefone: fromNumber, nome_contato: nome, ia_ativa: true, tipo_fluxo: "pastoral", status: "aberta" })
        .select().single()

      console.log(`[webhook] nova conversa: ${nova?.id} — ${nome} | erro: ${novaErr?.message ?? "none"}`)
      conversa = nova
      isNew = true
    } else {
      // Garante ia_ativa = true na conversa existente
      if (!conversa.ia_ativa) {
        await (supabase as any).from("conversas_whatsapp").update({ ia_ativa: true }).eq("id", conversa.id)
        conversa.ia_ativa = true
        console.log(`[webhook] ia_ativa ativada na conversa existente ${conversa.id}`)
      }
    }

    if (!conversa) return NextResponse.json({ ok: false, error: "falha ao criar conversa" })

    // Salva mensagem recebida
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id, direcao: "entrada", conteudo: text,
      tipo: "texto", status: "lido", msg_id_wpp: msgId ?? null,
    })
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: text, ultima_msg_at: new Date().toISOString(),
      nao_lidas: (conversa.nao_lidas ?? 0) + 1, status: "aberta",
    }).eq("id", conversa.id)

    // Busca histórico para decidir resposta
    const { data: historico } = await (supabase as any)
      .from("mensagens_whatsapp")
      .select("direcao, conteudo").eq("conversa_id", conversa.id)
      .order("created_at", { ascending: true }).limit(30)

    const temRespostaSaida = (historico ?? []).some((m: any) => m.direcao === "saida" && !m.conteudo?.startsWith("["))

    console.log(`[webhook] isNew=${isNew} temRespostaSaida=${temRespostaSaida}`)

    if (!uazapi.token || !uazapi.base_url) {
      console.log("[webhook] uazapi não configurada, pulando resposta")
      return NextResponse.json({ ok: true, conversa_id: conversa.id })
    }

    // Primeira mensagem: envia lista interativa de boas-vindas
    if (!temRespostaSaida) {
      const nome = conversa.nome_contato || "irmão(ã)"
      try {
        await sendList(uazapi, fromNumber, {
          text: `A paz do Senhor, ${nome}! 😊\n\nSou a assistente virtual da *${igrejaCfg.nome || "nossa Igreja"}*. É uma alegria falar com você!\n\nComo posso ajudar?`,
          listButton: "Ver opções",
          choices: [
            "[Como posso ajudar?]",
            "🙏 Pedido de oração|oracao|Quero pedir intercessão",
            "💰 Ajuda financeira|financeiro|Preciso de apoio",
            "💍 Aconselhamento|casamento|Questões conjugais ou familiares",
            "📖 Estudo bíblico|estudo|Quero crescer na Palavra",
            "[Estou bem]",
            "😊 Só passando para dizer oi|bem|Tudo ótimo, obrigado!",
          ],
          footer: "Nossa equipe pastoral está aqui por você ❤️",
        })
        console.log("[webhook] lista interativa enviada")
        await (supabase as any).from("mensagens_whatsapp").insert({
          conversa_id: conversa.id, direcao: "saida",
          conteudo: "[Lista interativa de boas-vindas enviada]", ia_gerada: true, status: "enviado",
        })
      } catch (e) { console.error("[webhook] erro ao enviar lista:", e) }
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

    return NextResponse.json({ ok: true, conversa_id: conversa.id })
  } catch (e: any) {
    console.error("[webhook] ERRO:", e.message, e.stack?.substring(0, 300))
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
