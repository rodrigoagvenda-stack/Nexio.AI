import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { sendText, sendList, sendButtons, sendLocation, rejectCall, UazapiConfig, parseWebhookPayload } from "@/lib/uazapi"

// ─── State machine: Assistência Financeira (sem OpenAI) ───────────────────────

async function handleFinanceiro(
  supabase: any, uazapi: UazapiConfig, cfg: any,
  conversa: any, fromNumber: string, text: string, selecao: string,
  igrejaCfg: any,
): Promise<boolean> {
  const step     = conversa.tipo_fluxo || "financeiro"
  const ctx      = conversa.contexto   || {}
  const igrejaNome = igrejaCfg.nome || "nossa Igreja"

  async function saveCtx(novoCtx: any, novoStep: string) {
    await (supabase as any).from("conversas_whatsapp").update({
      contexto: { ...ctx, ...novoCtx }, tipo_fluxo: novoStep,
    }).eq("id", conversa.id)
  }

  async function reply(txt: string) {
    await sendText(uazapi, fromNumber, txt)
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id, direcao: "saida", conteudo: txt, ia_gerada: true, status: "enviado",
    })
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: txt, ultima_msg_at: new Date().toISOString(),
    }).eq("id", conversa.id)
  }

  // ── STEP 0: Início — pede nome ──────────────────────────────────────────────
  if (step === "financeiro") {
    await saveCtx({}, "fin_nome")
    await reply("Precisamos de algumas informações para ajudar você. 💛\n\nQual é o seu *nome completo*?")
    return true
  }

  // ── STEP 1: Recebeu nome — pede "para quem" via botões ──────────────────────
  if (step === "fin_nome") {
    await saveCtx({ nome: text.trim() }, "fin_para")
    await sendButtons(uazapi, fromNumber, {
      text: `Obrigado, ${text.trim()}! 😊\n\nEssa necessidade é *para você* ou para *outra pessoa*?`,
      choices: ["Para mim|para_mim", "Para outra pessoa|para_outro"],
    })
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id, direcao: "saida", conteudo: "[Botões: para mim / outra pessoa]", ia_gerada: true, status: "enviado",
    })
    return true
  }

  // ── STEP 2: Para quem — se outro pede nome, senão vai para tipo ─────────────
  if (step === "fin_para") {
    const resp = selecao || text.toLowerCase()
    if (resp.includes("outro") || resp.includes("para_outro") || resp.includes("outra")) {
      await saveCtx({ para: "outro" }, "fin_nome_outro")
      await reply("Qual é o nome da pessoa que precisa de ajuda?")
    } else {
      // Para mim → vai direto para tipo
      await saveCtx({ para: "mim" }, "fin_tipo")
      await sendButtons(uazapi, fromNumber, {
        text: "Que tipo de ajuda você precisa?",
        choices: [
          "🛒 Cesta básica|cesta_basica",
          "🔥 Gás de cozinha|gas",
          "🏠 Aluguel/moradia|aluguel",
          "💊 Remédio|remedio",
          "📝 Outro|outro",
        ],
        footer: "Selecione uma opção",
      })
      await (supabase as any).from("mensagens_whatsapp").insert({
        conversa_id: conversa.id, direcao: "saida", conteudo: "[Botões: tipo de ajuda]", ia_gerada: true, status: "enviado",
      })
    }
    return true
  }

  // ── STEP 3: Nome do beneficiário — vai para tipo ─────────────────────────────
  if (step === "fin_nome_outro") {
    await saveCtx({ nome_beneficiario: text.trim() }, "fin_tipo")
    await sendButtons(uazapi, fromNumber, {
      text: `Entendido! Que tipo de ajuda ${text.trim()} precisa?`,
      choices: [
        "🛒 Cesta básica|cesta_basica",
        "🔥 Gás de cozinha|gas",
        "🏠 Aluguel/moradia|aluguel",
        "💊 Remédio|remedio",
        "📝 Outro|outro",
      ],
      footer: "Selecione uma opção",
    })
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id, direcao: "saida", conteudo: "[Botões: tipo de ajuda]", ia_gerada: true, status: "enviado",
    })
    return true
  }

  // ── STEP 4: Tipo selecionado — pede endereço ──────────────────────────────────
  if (step === "fin_tipo") {
    const tipoMap: Record<string, string> = {
      cesta_basica: "Cesta básica", gas: "Gás de cozinha",
      aluguel: "Aluguel/moradia", remedio: "Remédio", outro: "Outro",
    }
    const tipoKey  = selecao || text.toLowerCase().trim()
    const tipoLabel = tipoMap[tipoKey] || text.trim()
    await saveCtx({ tipo_ajuda: tipoLabel }, "fin_endereco")
    await reply(`*${tipoLabel}* anotado! 📝\n\nPara cadastrar o pedido, preciso do seu *endereço completo* (rua, número, bairro e cidade).`)
    return true
  }

  // ── STEP 5: Endereço recebido — salva tudo e encerra ─────────────────────────
  if (step === "fin_endereco") {
    const finalCtx = { ...ctx, endereco: text.trim() }

    // Busca membro pelo telefone
    const { data: membro } = await (supabase as any).from("membros").select("id")
      .ilike("telefone", `%${fromNumber.slice(-9)}%`).eq("igreja_id", igrejaCfg.id).maybeSingle()

    // Salva pedido de assistência
    const { error: insertErr } = await (supabase as any).from("pedidos_assistencia").insert({
      igreja_id:         igrejaCfg.id,
      membro_id:         membro?.id ?? null,
      nome:              finalCtx.nome,
      telefone:          fromNumber,
      para:              finalCtx.para || "mim",
      nome_beneficiario: finalCtx.nome_beneficiario || null,
      tipo_ajuda:        finalCtx.tipo_ajuda,
      endereco:          finalCtx.endereco,
      status:            "pendente",
    })
    if (insertErr) console.error("[fin_endereco] insert:", insertErr.message)
    else console.log("[fin_endereco] pedido assistência salvo!")

    // Notifica pastores
    const msgAlerta = `💰 *PEDIDO DE AJUDA FINANCEIRA — ${igrejaNome}*\n\n*Nome:* ${finalCtx.nome}\n*Tel:* ${fromNumber}\n*Para:* ${finalCtx.para === "outro" ? finalCtx.nome_beneficiario : "próprio solicitante"}\n*Tipo:* ${finalCtx.tipo_ajuda}\n*Endereço:* ${finalCtx.endereco}`
    const numeros: any[] = cfg.numeros_notificacao ?? []
    for (const dest of numeros.filter((n: any) => n.categoria === "geral" || n.categoria === "financeiro")) {
      try { await sendText(uazapi, dest.telefone, msgAlerta) } catch { /* silencioso */ }
    }

    // Confirmação ao membro + menu
    await reply(`✅ Pedido registrado com sucesso!\n\nNossa equipe irá analisar e entrar em contato em breve. Que Deus proveja! 🙏`)

    // Reset para pastoral + menu
    await (supabase as any).from("conversas_whatsapp").update({
      tipo_fluxo: "pastoral", contexto: {},
    }).eq("id", conversa.id)

    try {
      await sendList(uazapi, fromNumber, {
        text: "Posso ajudar com mais alguma coisa? 😊",
        listButton: "Ver opções",
        choices: [
          "[Como posso ajudar?]",
          "🙏 Pedido de oração|oracao|Quero pedir intercessão",
          "💰 Ajuda financeira|financeiro|Preciso de apoio",
          "💍 Aconselhamento|casamento|Questões conjugais ou familiares",
          "📖 Estudo bíblico|estudo|Quero crescer na Palavra",
          "[Estou bem]",
          "😊 Não preciso de mais nada|bem|Obrigado!",
        ],
        footer: "Nossa equipe pastoral está aqui por você ❤️",
      })
    } catch { /* silencioso */ }

    return true
  }

  return false
}

// ─── Prompts OpenAI (apenas oração e aconselhamento) ─────────────────────────

const PROMPTS: Record<string, string> = {
  oracao: `Você é a assistente pastoral da igreja. Colete 3 informações — UMA DE CADA VEZ — para registrar um pedido de oração.

REGRAS:
- Leia o histórico completo antes de responder
- NUNCA repita pergunta já respondida
- Avance sempre para a próxima informação em falta
- Respostas curtas e acolhedoras

ORDEM:
1. Nome completo
2. A oração é para você ou para um ente querido? (se outro, qual nome?)
3. Motivo/área (saúde, família, trabalho, financeiro, espiritual...)

Quando tiver as 3, responda SOMENTE:
DADOS_ORACAO: {"nome":"...","para":"ele|ente_querido","nome_ente":"...","motivo":"...","categoria":"saude|familia|trabalho|financeiro|espiritual|outro"}`,

  casamento: `Você é a assistente pastoral da igreja. Colete 3 informações — UMA DE CADA VEZ — para encaminhar um pedido de aconselhamento.

REGRAS:
- Leia o histórico antes de responder — não repita o que já foi respondido
- Avance sempre para a próxima pergunta pendente
- Seja acolhedor e empático

ORDEM:
1. Nome completo
2. Nome do cônjuge/familiar (pode pular)
3. Situação/motivo

Quando tiver as 3, responda SOMENTE:
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
  for (const dest of numeros.filter((n: any) => n.categoria === "geral" || n.categoria === categoria)) {
    try { await sendText(uazapi, dest.telefone, mensagem) } catch { /* silencioso */ }
  }
}

// ─── processarDadosCompletos (oração + aconselhamento) ───────────────────────

async function processarDadosCompletos(
  supabase: any, uazapi: UazapiConfig, cfg: any,
  conversa: any, resposta: string, igrejaNome: string, igrejaId: string,
): Promise<boolean> {

  async function findMembroId(): Promise<string | null> {
    const { data } = await (supabase as any).from("membros").select("id")
      .ilike("telefone", `%${conversa.telefone?.slice(-9) ?? ""}%`)
      .eq("igreja_id", igrejaId).maybeSingle()
    return data?.id ?? null
  }

  async function menuDeVolta() {
    try {
      await sendList(uazapi, conversa.telefone, {
        text: "Posso ajudar com mais alguma coisa? 😊",
        listButton: "Ver opções",
        choices: [
          "[Como posso ajudar?]",
          "🙏 Pedido de oração|oracao|Quero pedir intercessão",
          "💰 Ajuda financeira|financeiro|Preciso de apoio",
          "💍 Aconselhamento|casamento|Questões conjugais ou familiares",
          "📖 Estudo bíblico|estudo|Quero crescer na Palavra",
          "[Estou bem]",
          "😊 Não preciso de mais nada|bem|Obrigado!",
        ],
        footer: "Nossa equipe pastoral está aqui por você ❤️",
      })
    } catch { /* silencioso */ }
    await (supabase as any).from("conversas_whatsapp").update({
      tipo_fluxo: "pastoral", contexto: {},
    }).eq("id", conversa.id)
  }

  // ── Oração ──
  const orIdx = resposta.indexOf("DADOS_ORACAO:")
  if (orIdx !== -1) {
    try {
      const json = JSON.parse(resposta.substring(orIdx + 13).trim())
      const membroId = await findMembroId()
      const { error } = await (supabase as any).from("pedidos_oracao").insert({
        membro_id: membroId, titulo: `Pedido de ${json.nome}`,
        descricao: `Para: ${json.para === "ele" ? "próprio solicitante" : (json.nome_ente ?? "ente querido")}. Motivo: ${json.motivo}`,
        categoria: json.categoria || "outro", status: "ativo",
        privacidade: "lideranca", data_pedido: new Date().toISOString(),
      })
      if (error) console.error("[DADOS_ORACAO] insert:", error.message)
      else console.log("[DADOS_ORACAO] pedido registrado!")
      const msg = `🙏 *PEDIDO DE ORAÇÃO — ${igrejaNome}*\n\n*Nome:* ${json.nome}\n*Para:* ${json.para === "ele" ? "Próprio solicitante" : json.nome_ente}\n*Motivo:* ${json.motivo}`
      await notificarPastores(uazapi, cfg, "pastoral", msg)
      await sendText(uazapi, conversa.telefone, `Amém, ${json.nome}! 🙏 Seu pedido de oração foi registrado e encaminhado à liderança. Nossos líderes irão interceder por você. Que Deus te abençoe! ❤️`)
      await menuDeVolta()
      return true
    } catch (e) { console.error("[DADOS_ORACAO] parse:", e) }
  }

  // ── Aconselhamento ──
  const aconIdx = resposta.indexOf("DADOS_ACONSELHAMENTO:")
  if (aconIdx !== -1) {
    try {
      const json = JSON.parse(resposta.substring(aconIdx + 21).trim())
      const msg = `💍 *PEDIDO DE ACONSELHAMENTO — ${igrejaNome}*\n\n*Nome:* ${json.nome}\n*Envolvido(a):* ${json.nome_conjuge || "Não informado"}\n*Situação:* ${json.motivo}`
      await notificarPastores(uazapi, cfg, "casamento", msg)
      await sendText(uazapi, conversa.telefone, `Obrigado pela confiança, ${json.nome}. ❤️ Seu pedido foi encaminhado ao pastor responsável. Você não está sozinho(a)!`)
      await menuDeVolta()
      return true
    } catch (e) { console.error("[DADOS_ACONSELHAMENTO] parse:", e) }
  }

  return false
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: any = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const eventType = body?.EventType ?? body?.event ?? body?.type ?? ""
  console.log(`[webhook] EventType="${eventType}" instance="${body?.instanceName ?? ""}"`)

  // ── Chamadas de voz ──────────────────────────────────────────────────────────
  if (eventType.toLowerCase().includes("call")) {
    const callNumber = body?.message?.chatid?.replace("@s.whatsapp.net","").replace(/\D/g,"") ?? ""
    const callId     = body?.message?.id ?? ""
    const supaDb     = createServiceClient()
    const { data: igs } = await (supaDb as any).from("igrejas").select("configuracoes")
    const ig = (igs ?? []).find((i: any) => i.configuracoes?.uazapi_token)
    if (ig) {
      const ua: UazapiConfig = { base_url: ig.configuracoes.uazapi_base_url, token: ig.configuracoes.uazapi_token }
      try { await rejectCall(ua, callNumber || undefined, callId || undefined) } catch { /* silencioso */ }
      if (callNumber) try { await sendText(ua, callNumber, "Olá! Sou a assistente virtual e não consigo atender ligações. 😊\nEnvie uma mensagem de texto que responderei prontamente! 🙏") } catch { /* silencioso */ }
    }
    return NextResponse.json({ ok: true, handled: "call_rejected" })
  }

  if (eventType && !eventType.toLowerCase().includes("message")) {
    return NextResponse.json({ ok: true, skipped: eventType })
  }

  const parsed = parseWebhookPayload(body)
  if (!parsed) { console.log("[webhook] ignorado"); return NextResponse.json({ ok: true }) }

  const { fromNumber, text, msgId, pushName, instanceName } = parsed
  const selecao = body?.message?.buttonOrListid || ""
  console.log(`[webhook] de=${fromNumber} texto="${text.substring(0,40)}" selecao="${selecao}"`)

  try {
    const supabase = createServiceClient()

    const { data: igrejas } = await (supabase as any).from("igrejas").select("id, nome, configuracoes")
    if (!igrejas?.length) return NextResponse.json({ ok: false, error: "nenhuma igreja" })

    const igrejaCfg =
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_instance?.toLowerCase() === (instanceName ?? "").toLowerCase()) ??
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_token)
    if (!igrejaCfg) return NextResponse.json({ ok: false, error: "nenhuma igreja configurada" })

    const cfg    = igrejaCfg.configuracoes ?? {}
    const uazapi: UazapiConfig = { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }
    console.log(`[webhook] ${igrejaCfg.nome} | uazapi:${uazapi.token?"ok":"MISS"} | openai:${cfg.openai_api_key?"ok":"MISS"}`)

    // Busca ou cria conversa
    let { data: conversa } = await (supabase as any)
      .from("conversas_whatsapp")
      .select("id, nome_contato, ia_ativa, tipo_fluxo, nao_lidas, telefone, contexto")
      .eq("telefone", fromNumber).eq("igreja_id", igrejaCfg.id)
      .neq("status", "encerrada").maybeSingle()

    if (!conversa) {
      const { data: membro } = await (supabase as any).from("membros").select("id, nome")
        .ilike("telefone", `%${fromNumber.slice(-9)}%`).eq("igreja_id", igrejaCfg.id).maybeSingle()
      const nome = membro?.nome ?? pushName ?? fromNumber
      const { data: nova } = await (supabase as any).from("conversas_whatsapp")
        .insert({ igreja_id: igrejaCfg.id, telefone: fromNumber, nome_contato: nome, ia_ativa: true, tipo_fluxo: "pastoral", contexto: {}, status: "aberta" })
        .select().single()
      conversa = nova
    } else if (!conversa.ia_ativa) {
      await (supabase as any).from("conversas_whatsapp").update({ ia_ativa: true }).eq("id", conversa.id)
      conversa.ia_ativa = true
    }

    if (!conversa) return NextResponse.json({ ok: false })

    // Salva mensagem recebida
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id: conversa.id, direcao: "entrada", conteudo: text, tipo: "texto", status: "lido", msg_id_wpp: msgId ?? null,
    })
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: text, ultima_msg_at: new Date().toISOString(),
      nao_lidas: (conversa.nao_lidas ?? 0) + 1, status: "aberta",
    }).eq("id", conversa.id)

    if (!uazapi.token || !uazapi.base_url) return NextResponse.json({ ok: true })

    const step = conversa.tipo_fluxo || "pastoral"

    // ── FLUXO FINANCEIRO (state machine, sem OpenAI) ──────────────────────────
    if (step.startsWith("financeiro") || selecao === "financeiro") {
      if (selecao === "financeiro") {
        await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: "financeiro", contexto: {} }).eq("id", conversa.id)
        conversa.tipo_fluxo = "financeiro"
        conversa.contexto   = {}
      }
      await handleFinanceiro(supabase, uazapi, cfg, conversa, fromNumber, text, selecao, igrejaCfg)
      return NextResponse.json({ ok: true })
    }

    // ── ESTUDO BÍBLICO ────────────────────────────────────────────────────────
    if (selecao === "estudo") {
      await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: "pastoral" }).eq("id", conversa.id)
      const convite = `Que alegria! 📖✨\n\nTe convidamos para o *Culto de Sã Doutrina*!\n\n📅 *Toda segunda-feira*\n🕖 *19h00*\n📍 Rua da Constelação, 150 — Panorama, Vitória da Conquista — BA\n\nTe esperamos! 🕊️`
      await sendText(uazapi, fromNumber, convite)
      try { await sendLocation(uazapi, fromNumber, { name: igrejaCfg.nome, address: "Rua da Constelação, 150 — Panorama, Vitória da Conquista — BA", latitude: -14.8595, longitude: -40.8520 }) } catch { /* silencioso */ }
      await (supabase as any).from("mensagens_whatsapp").insert({ conversa_id: conversa.id, direcao: "saida", conteudo: convite, ia_gerada: true, status: "enviado" })
      return NextResponse.json({ ok: true })
    }

    // ── BEM ───────────────────────────────────────────────────────────────────
    if (selecao === "bem") {
      const resp = `Que bênção! 😊🙌 Continue firme na fé! Nossa porta está sempre aberta. Deus te abençoe! ❤️`
      await sendText(uazapi, fromNumber, resp)
      await (supabase as any).from("mensagens_whatsapp").insert({ conversa_id: conversa.id, direcao: "saida", conteudo: resp, ia_gerada: true, status: "enviado" })
      return NextResponse.json({ ok: true })
    }

    // ── SAUDAÇÕES — sempre exibem o menu ─────────────────────────────────────
    const GREETINGS = ["olá","ola","oi","oi!","menu","inicio","início","voltar","ok","obrigado","obrigada","valeu","tchaui","tchau","até"]
    const isGreeting = !selecao && GREETINGS.includes(text.toLowerCase().trim().replace(/[!.?]+$/,""))

    if (isGreeting || step === "pastoral" || selecao === "menu") {
      await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: "pastoral", contexto: {} }).eq("id", conversa.id)
      const nome = conversa.nome_contato || "irmão(ã)"
      try {
        await sendList(uazapi, fromNumber, {
          text: `A paz do Senhor, ${nome}! 😊\n\nComo posso ajudar?`,
          listButton: "Ver opções",
          choices: [
            "[Como posso ajudar?]",
            "🙏 Pedido de oração|oracao|Quero pedir intercessão",
            "💰 Ajuda financeira|financeiro|Preciso de apoio",
            "💍 Aconselhamento|casamento|Questões conjugais ou familiares",
            "📖 Estudo bíblico|estudo|Quero crescer na Palavra",
            "[Estou bem]",
            "😊 Não preciso de nada|bem|Tudo ótimo!",
          ],
          footer: "Nossa equipe pastoral está aqui por você ❤️",
        })
        await (supabase as any).from("mensagens_whatsapp").insert({ conversa_id: conversa.id, direcao: "saida", conteudo: "[Menu interativo]", ia_gerada: true, status: "enviado" })
      } catch (e) { console.error("[webhook] sendList:", e) }
      return NextResponse.json({ ok: true })
    }

    // ── ORAÇÃO e ACONSELHAMENTO (OpenAI) ─────────────────────────────────────
    if (!cfg.openai_api_key) return NextResponse.json({ ok: true })

    if (selecao === "oracao" || selecao === "casamento") {
      await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: selecao, contexto: {} }).eq("id", conversa.id)
      conversa.tipo_fluxo = selecao
    }

    const fluxoAtivo = conversa.tipo_fluxo || "pastoral"
    if (!PROMPTS[fluxoAtivo]) return NextResponse.json({ ok: true })

    const { data: historico } = await (supabase as any)
      .from("mensagens_whatsapp").select("direcao, conteudo")
      .eq("conversa_id", conversa.id).order("created_at", { ascending: true }).limit(30)

    const respostaRaw = await callOpenAI(cfg.openai_api_key, cfg.openai_model, PROMPTS[fluxoAtivo], historico ?? [])
    if (!respostaRaw) return NextResponse.json({ ok: true })

    const handled = await processarDadosCompletos(supabase, uazapi, cfg, conversa, respostaRaw, igrejaCfg.nome ?? "Igreja", igrejaCfg.id)
    if (handled) return NextResponse.json({ ok: true })

    const respostaFinal = respostaRaw.replace(/DADOS_\w+:[\s\S]*$/, "").trim()
    if (!respostaFinal) return NextResponse.json({ ok: true })

    await sendText(uazapi, fromNumber, respostaFinal)
    await (supabase as any).from("mensagens_whatsapp").insert({ conversa_id: conversa.id, direcao: "saida", conteudo: respostaFinal, ia_gerada: true, status: "enviado" })
    await (supabase as any).from("conversas_whatsapp").update({ ultima_mensagem: respostaFinal, ultima_msg_at: new Date().toISOString() }).eq("id", conversa.id)

    return NextResponse.json({ ok: true, conversa_id: conversa.id })
  } catch (e: any) {
    console.error("[webhook] ERRO:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
