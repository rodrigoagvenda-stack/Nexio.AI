import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { sendText, sendList, sendLocation, rejectCall, UazapiConfig, parseWebhookPayload } from "@/lib/uazapi"

// ─── Prompts por fluxo ────────────────────────────────────────────────────────

const PROMPTS: Record<string, string> = {
  oracao: `Você é a assistente pastoral da igreja. Colete as seguintes informações de forma gentil e natural (uma pergunta por vez):
1. Nome completo do solicitante
2. A oração é para ele(a) ou para um ente querido? (se for ente querido, qual o nome?)
3. Qual é o motivo ou área da oração? (saúde, família, trabalho, financeiro, espiritual, relacionamento...)

Quando tiver todas as informações, responda APENAS com este JSON (sem mais texto):
DADOS_ORACAO: {"nome":"...","para":"ele|ente_querido","nome_ente":"...","motivo":"...","categoria":"saude|familia|trabalho|financeiro|espiritual|outro"}`,

  financeiro: `Você é a assistente pastoral da igreja. Colete as informações de forma gentil (uma por vez):
1. Nome completo
2. A necessidade é para ele(a) ou para outra pessoa? (se outra, qual nome?)
3. Qual o tipo de ajuda necessária? (cesta básica, gás, aluguel, remédio, outro...)
4. Pode descrever brevemente a situação?

Quando tiver tudo, responda APENAS:
DADOS_FINANCEIRO: {"nome":"...","para":"ele|outro","nome_outro":"...","tipo_ajuda":"...","situacao":"..."}`,

  casamento: `Você é a assistente pastoral da igreja. Colete as informações com cuidado e empatia (uma por vez):
1. Nome completo de quem está buscando ajuda
2. Nome do cônjuge ou familiar envolvido (se quiser informar)
3. Qual é a situação ou motivo que trouxe até nós?

Seja acolhedor, sem julgamentos. Quando tiver as informações:
DADOS_ACONSELHAMENTO: {"nome":"...","nome_conjuge":"...","motivo":"..."}`,
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(apiKey: string, model: string, system: string, historico: any[]): Promise<string> {
  const messages = [
    { role: "system", content: system },
    ...historico
      .filter((m: any) => !m.conteudo?.startsWith("["))
      .slice(-20)
      .map((m: any) => ({ role: m.direcao === "saida" ? "assistant" : "user", content: m.conteudo })),
  ]
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || "gpt-4o-mini", messages, max_tokens: 500, temperature: 0.7 }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) { console.error("[OpenAI]", res.status); return "" }
  return (await res.json()).choices?.[0]?.message?.content ?? ""
}

// ─── Notifica pastores ────────────────────────────────────────────────────────

async function notificarPastores(uazapi: UazapiConfig, cfg: any, categoria: string, mensagem: string) {
  const numeros: any[] = cfg.numeros_notificacao ?? []
  const destinatarios = numeros.filter((n: any) => n.categoria === "geral" || n.categoria === categoria)
  for (const dest of destinatarios) {
    try { await sendText(uazapi, dest.telefone, mensagem) } catch { /* silencioso */ }
  }
}

// ─── Detecta e processa dados completos ──────────────────────────────────────

async function processarDadosCompletos(
  supabase: any,
  uazapi: UazapiConfig,
  cfg: any,
  conversa: any,
  resposta: string,
  igrejaNome: string,
): Promise<string | null> {

  // ── Oração ──
  const orIdx = resposta.indexOf("DADOS_ORACAO:")
  if (orIdx !== -1) {
    try {
      const json = JSON.parse(resposta.substring(orIdx + 13).trim())
      // Salva pedido de oração
      await (supabase as any).from("pedidos_oracao").insert({
        titulo: `Pedido de ${json.nome}`,
        descricao: `Motivo: ${json.motivo}. Para: ${json.para === "ele" ? json.nome : json.nome_ente ?? "ente querido"}`,
        categoria: json.categoria || "outro",
        status: "ativo",
        privacidade: "lideranca",
      })
      // Notifica
      const msg = `🙏 *PEDIDO DE ORAÇÃO — ${igrejaNome}*\n\n*Nome:* ${json.nome}\n*Para:* ${json.para === "ele" ? "Próprio solicitante" : json.nome_ente}\n*Motivo:* ${json.motivo}\n*Categoria:* ${json.categoria}`
      await notificarPastores(uazapi, cfg, "pastoral", msg)
      // Resposta ao membro
      return `Amém, ${json.nome}! 🙏 Seu pedido de oração foi registrado e encaminhado à liderança da ${igrejaNome}. Nossos líderes irão interceder por você. Que Deus te abençoe grandemente! ❤️`
    } catch (e) { console.error("[DADOS_ORACAO] parse:", e) }
  }

  // ── Financeiro ──
  const finIdx = resposta.indexOf("DADOS_FINANCEIRO:")
  if (finIdx !== -1) {
    try {
      const json = JSON.parse(resposta.substring(finIdx + 17).trim())
      const msg = `💰 *PEDIDO DE AJUDA FINANCEIRA — ${igrejaNome}*\n\n*Nome:* ${json.nome}\n*Para:* ${json.para === "ele" ? "Próprio solicitante" : json.nome_outro}\n*Tipo de ajuda:* ${json.tipo_ajuda}\n*Situação:* ${json.situacao}`
      await notificarPastores(uazapi, cfg, "financeiro", msg)
      return `Obrigado por confiar em nós, ${json.nome}. 💛 Sua solicitação foi encaminhada para a equipe responsável da ${igrejaNome}. Entraremos em contato em breve. Que Deus supra todas as suas necessidades!`
    } catch (e) { console.error("[DADOS_FINANCEIRO] parse:", e) }
  }

  // ── Aconselhamento ──
  const aconIdx = resposta.indexOf("DADOS_ACONSELHAMENTO:")
  if (aconIdx !== -1) {
    try {
      const json = JSON.parse(resposta.substring(aconIdx + 21).trim())
      const msg = `💍 *PEDIDO DE ACONSELHAMENTO — ${igrejaNome}*\n\n*Nome:* ${json.nome}\n*Envolvido(a):* ${json.nome_conjuge || "Não informado"}\n*Situação:* ${json.motivo}`
      await notificarPastores(uazapi, cfg, "casamento", msg)
      return `Obrigado pela confiança, ${json.nome}. ❤️ Seu pedido de aconselhamento foi encaminhado ao pastor responsável da ${igrejaNome}. Ele entrará em contato em breve. Você não está sozinho(a)!`
    } catch (e) { console.error("[DADOS_ACONSELHAMENTO] parse:", e) }
  }

  return null
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: any = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const eventType = body?.EventType ?? body?.event ?? body?.type ?? ""
  console.log(`[webhook] EventType="${eventType}" instance="${body?.instanceName ?? ""}"`)

  // ── Chamadas de voz: rejeitar e avisar ──────────────────────────────────────
  if (eventType.toLowerCase().includes("call")) {
    const callNumber: string = body?.message?.chatid?.replace("@s.whatsapp.net","").replace(/\D/g,"") ?? body?.from ?? ""
    const callId: string = body?.message?.id ?? body?.call_id ?? ""
    // Tenta rejeitar
    if (body?.BaseUrl && body?.instanceName) {
      const { data: igrejas } = await (createServiceClient() as any).from("igrejas").select("configuracoes")
      const ig = (igrejas ?? []).find((i: any) => i.configuracoes?.uazapi_token)
      if (ig?.configuracoes?.uazapi_token) {
        const ua: UazapiConfig = { base_url: ig.configuracoes.uazapi_base_url, token: ig.configuracoes.uazapi_token }
        try { await rejectCall(ua, callNumber || undefined, callId || undefined) } catch { /* silencioso */ }
        if (callNumber) {
          try {
            await sendText(ua, callNumber, "Olá! Sou a assistente virtual da nossa igreja e não consigo atender ligações. 😊\n\nPor favor, me envie uma mensagem de texto que responderei com prazer! 🙏")
          } catch { /* silencioso */ }
        }
      }
    }
    return NextResponse.json({ ok: true, handled: "call_rejected" })
  }

  if (eventType && !eventType.toLowerCase().includes("message")) {
    return NextResponse.json({ ok: true, skipped: eventType })
  }

  const parsed = parseWebhookPayload(body)
  if (!parsed) { console.log("[webhook] ignorado — fromMe ou sem texto"); return NextResponse.json({ ok: true }) }

  const { fromNumber, text, msgId, pushName, instanceName } = parsed
  // Detecta seleção de botão/lista
  const selecao = body?.message?.buttonOrListid || ""
  console.log(`[webhook] de=${fromNumber} texto="${text.substring(0, 50)}" selecao="${selecao}"`)

  try {
    const supabase = createServiceClient()

    const { data: igrejas } = await (supabase as any).from("igrejas").select("id, nome, configuracoes")
    console.log(`[webhook] igrejas: ${igrejas?.length ?? 0}`)
    if (!igrejas?.length) return NextResponse.json({ ok: false, error: "nenhuma igreja" })

    const igrejaCfg =
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_instance?.toLowerCase() === (instanceName ?? "").toLowerCase()) ??
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_token)

    if (!igrejaCfg) return NextResponse.json({ ok: false, error: "nenhuma igreja configurada" })

    const cfg    = igrejaCfg.configuracoes ?? {}
    const uazapi: UazapiConfig = { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }

    console.log(`[webhook] igreja: ${igrejaCfg.nome} | uazapi: ${uazapi.token ? "ok" : "MISSING"} | openai: ${cfg.openai_api_key ? "ok" : "MISSING"}`)

    // Busca ou cria conversa
    let { data: conversa } = await (supabase as any)
      .from("conversas_whatsapp")
      .select("id, nome_contato, ia_ativa, tipo_fluxo, nao_lidas, telefone")
      .eq("telefone", fromNumber).eq("igreja_id", igrejaCfg.id)
      .neq("status", "encerrada").maybeSingle()

    if (!conversa) {
      const { data: membro } = await (supabase as any).from("membros").select("id, nome")
        .ilike("telefone", `%${fromNumber.slice(-9)}%`).eq("igreja_id", igrejaCfg.id).maybeSingle()
      const nome = membro?.nome ?? pushName ?? fromNumber
      const { data: nova } = await (supabase as any).from("conversas_whatsapp")
        .insert({ igreja_id: igrejaCfg.id, telefone: fromNumber, nome_contato: nome, ia_ativa: true, tipo_fluxo: "pastoral", status: "aberta" })
        .select().single()
      conversa = nova
      console.log(`[webhook] nova conversa: ${nova?.id} — ${nome}`)
    } else if (!conversa.ia_ativa) {
      await (supabase as any).from("conversas_whatsapp").update({ ia_ativa: true }).eq("id", conversa.id)
      conversa.ia_ativa = true
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

    if (!uazapi.token || !uazapi.base_url) {
      console.log("[webhook] uazapi não configurada")
      return NextResponse.json({ ok: true, conversa_id: conversa.id })
    }

    // Detecta fluxo pela seleção da lista
    const fluxoSelecionado = selecao || conversa.tipo_fluxo || "pastoral"

    // ── ESTUDO BÍBLICO ────────────────────────────────────────────────────────
    if (selecao === "estudo") {
      await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: "estudo" }).eq("id", conversa.id)
      const nome = conversa.nome_contato || "irmão(ã)"

      const convite = `Que alegria, ${nome}! 📖✨\n\nTe convidamos para o nosso *Culto de Sã Doutrina*, um momento especial de aprofundamento na Palavra de Deus!\n\n📅 *Toda segunda-feira*\n🕖 *19h00*\n\n📍 *${igrejaCfg.nome || "Igreja Pentecostal Vale da Bênção"}*\nRua da Constelação, 150 — Panorama\nVitória da Conquista — BA\n\nSua presença faz toda a diferença para construir uma base espiritual sólida! Te esperamos com muito amor. 🕊️`

      await sendText(uazapi, fromNumber, convite)

      // Envia localização
      try {
        await sendLocation(uazapi, fromNumber, {
          name: igrejaCfg.nome || "Igreja Pentecostal Vale da Bênção",
          address: "Rua da Constelação, 150 — Panorama, Vitória da Conquista — BA",
          latitude: -14.8595,
          longitude: -40.8520,
        })
      } catch (e) { console.error("[webhook] sendLocation:", e) }

      await (supabase as any).from("mensagens_whatsapp").insert({
        conversa_id: conversa.id, direcao: "saida", conteudo: convite, ia_gerada: true, status: "enviado",
      })
      return NextResponse.json({ ok: true })
    }

    // ── BEM (TUDO ÓTIMO) ──────────────────────────────────────────────────────
    if (selecao === "bem") {
      const nome = conversa.nome_contato || "irmão(ã)"
      const resp = `Que bênção saber que você está bem, ${nome}! 😊🙌\n\nContinue firme na fé! Lembre-se que nossa porta está sempre aberta. Se precisar de qualquer coisa, é só chamar. Deus te abençoe! ❤️`
      await sendText(uazapi, fromNumber, resp)
      await (supabase as any).from("mensagens_whatsapp").insert({
        conversa_id: conversa.id, direcao: "saida", conteudo: resp, ia_gerada: true, status: "enviado",
      })
      await (supabase as any).from("conversas_whatsapp").update({ ultima_mensagem: resp, ultima_msg_at: new Date().toISOString() }).eq("id", conversa.id)
      return NextResponse.json({ ok: true })
    }

    // ── FLUXOS COM COLETA DE DADOS (oração, financeiro, aconselhamento) ───────
    if (!cfg.openai_api_key) { console.log("[webhook] sem openai"); return NextResponse.json({ ok: true }) }

    // Atualiza tipo_fluxo se veio de seleção
    if (selecao && ["oracao","financeiro","casamento"].includes(selecao)) {
      await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: selecao }).eq("id", conversa.id)
      conversa.tipo_fluxo = selecao
    }

    // Busca histórico
    const { data: historico } = await (supabase as any)
      .from("mensagens_whatsapp").select("direcao, conteudo")
      .eq("conversa_id", conversa.id).order("created_at", { ascending: true }).limit(30)

    const temRespostaSaida = (historico ?? []).some((m: any) => m.direcao === "saida" && !m.conteudo?.startsWith("["))
    const fluxoAtivo = conversa.tipo_fluxo || "pastoral"

    // Primeira mensagem → menu de boas-vindas
    if (!temRespostaSaida && !["oracao","financeiro","casamento"].includes(selecao)) {
      const nome = conversa.nome_contato || "irmão(ã)"
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
      await (supabase as any).from("mensagens_whatsapp").insert({
        conversa_id: conversa.id, direcao: "saida", conteudo: "[Lista interativa de boas-vindas]", ia_gerada: true, status: "enviado",
      })
      return NextResponse.json({ ok: true })
    }

    // Prompt do fluxo ativo
    const systemPrompt = PROMPTS[fluxoAtivo] ?? PROMPTS.oracao

    console.log(`[webhook] OpenAI fluxo="${fluxoAtivo}"`)
    const respostaRaw = await callOpenAI(cfg.openai_api_key, cfg.openai_model, systemPrompt, historico ?? [])
    if (!respostaRaw) return NextResponse.json({ ok: true })

    // Verifica se IA coletou todos os dados
    const respostaPasta = await processarDadosCompletos(supabase, uazapi, cfg, conversa, respostaRaw, igrejaCfg.nome ?? "Igreja")

    const respostaFinal = respostaPasta ?? respostaRaw
    console.log(`[webhook] resposta: "${respostaFinal.substring(0, 80)}"`)

    await sendText(uazapi, fromNumber, respostaFinal)
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id, direcao: "saida", conteudo: respostaFinal, ia_gerada: true, status: "enviado",
    })
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: respostaFinal, ultima_msg_at: new Date().toISOString(),
    }).eq("id", conversa.id)

    return NextResponse.json({ ok: true, conversa_id: conversa.id })
  } catch (e: any) {
    console.error("[webhook] ERRO:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
