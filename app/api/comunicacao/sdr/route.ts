import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendText, sendButtons, sendList, UazapiConfig } from "@/lib/uazapi"

// ─── Prompts por fluxo ────────────────────────────────────────────────────────

function buildSystemPrompt(fluxo: string, cfg: any, ctx: any): string {
  const assistente = cfg?.sdr_nome || "Assistente Missionária Virtual"
  const igreja     = ctx?.nome_igreja || "nossa Igreja"
  const membro     = ctx?.nome_membro || "irmão(ã)"

  const base = `Você é ${assistente} da ${igreja}. Responda sempre em português brasileiro, de forma natural, acolhedora e breve (máx. 3 frases por mensagem). Nunca se repita.`

  if (fluxo === "escala") return `${base}
Sua missão: confirmar se ${membro} pode servir na escala de cultos. Seja direto e gentil.
Após confirmar ou negar, gere internamente: RESUMO_SDR: confirmou=sim/não | motivo=... (não mostre isso ao usuário).`

  if (fluxo === "pastoral") return `${base}
Sua missão: conectar-se pastoralmente com ${membro}. Pergunte como está a vida, família e fé.
Se identificar necessidade, anote. Categorias: financeiro | casamento | saude | espiritual.
Se for urgente, inclua no final (invisível): ALERTA_PASTORAL: categoria=... | gravidade=alta/media
Ao encerrar: RESUMO_SDR: necessidade=... | gravidade=...`

  if (fluxo === "visitante") return `${base}
${membro} visitou nossa igreja. Agradeça com calor. Pergunte como foi a experiência e peça uma nota de 1 a 5.
Ao final: RESUMO_SDR: nota=... | deseja_retorno=sim/não`

  if (fluxo === "convertido") return `${base}
${membro} tomou uma decisão de fé recentemente. Parabenize, pergunte como se sente e ofereça acompanhamento.
Ao final: RESUMO_SDR: status=acompanhado | próximo_contato=...`

  return base
}

// ─── Mensagens interativas por fluxo (primeiro contato) ──────────────────────

async function sendFlowOpener(uazapi: UazapiConfig, number: string, fluxo: string, nome: string, escalaInfo?: string) {
  if (fluxo === "escala") {
    await sendButtons(uazapi, number, {
      text: `A paz do Senhor, ${nome}! 🙏\n\nVocê está na escala de cultos${escalaInfo ? ` — *${escalaInfo}*` : ""}.\n\nVocê tem disponibilidade para servir?`,
      choices: ["✅ Sim, confirmo|confirmar", "❌ Não poderei|nao_posso"],
      footer: "Responda ou clique em uma opção",
    })
    return
  }

  if (fluxo === "pastoral") {
    await sendList(uazapi, number, {
      text: `A paz do Senhor, ${nome}! 😊\n\nSou a assistente virtual da nossa igreja. Passando para saber como você está.\n\nPrecisa de algum suporte?`,
      listButton: "Ver opções de suporte",
      choices: [
        "[Como posso ajudar?]",
        "🙏 Pedido de oração|oracao|Quero pedir oração",
        "💰 Ajuda financeira|financeiro|Preciso de apoio financeiro",
        "💍 Aconselhamento conjugal|casamento|Quero falar sobre meu casamento",
        "👨‍👩‍👧 Apoio familiar|familia|Preciso de apoio para minha família",
        "📖 Estudo bíblico|estudo|Quero me aprofundar na Palavra",
        "[Estou bem]",
        "😊 Estou bem, obrigado|bem|Estou ótimo!",
      ],
      footer: "Nossa equipe pastoral está disponível",
    })
    return
  }

  if (fluxo === "visitante") {
    await sendButtons(uazapi, number, {
      text: `A paz do Senhor, ${nome}! 🕊️\n\nObrigado por nos visitar! Foi uma alegria ter você conosco.\n\nComo foi sua experiência em nossa igreja?`,
      choices: ["⭐⭐⭐⭐⭐ Excelente|excelente", "⭐⭐⭐⭐ Muito boa|muito_boa", "⭐⭐⭐ Boa|boa", "💬 Quero comentar|comentar"],
      footer: "Sua opinião é muito importante para nós",
    })
    return
  }

  if (fluxo === "convertido") {
    await sendButtons(uazapi, number, {
      text: `A paz do Senhor, ${nome}! 🕊️\n\nQue alegria imensa sua decisão de fé! Toda a igreja celebra com você.\n\nComo você está se sentindo?`,
      choices: ["😊 Muito feliz!|feliz", "🤔 Com dúvidas|duvidas", "💬 Quero conversar|conversar"],
      footer: "Estamos aqui para acompanhar você",
    })
    return
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { conversa_id, historico, fluxo, contexto, primeiro_contato } = body

  if (!conversa_id) return NextResponse.json({ error: "conversa_id obrigatório" }, { status: 400 })

  const { data: conversa } = await (supabase as any)
    .from("conversas_whatsapp").select("telefone, igreja_id, nome_contato").eq("id", conversa_id).single()
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 })

  const { data: igData } = await (supabase as any)
    .from("igrejas").select("configuracoes, nome").eq("id", conversa.igreja_id).single()
  const cfg       = igData?.configuracoes ?? {}
  const igrejaNome = igData?.nome ?? "Igreja"

  if (!cfg.openai_api_key) {
    return NextResponse.json({ error: "Configure a chave OpenAI na Área Administrativa." }, { status: 400 })
  }

  const uazapiCfg: UazapiConfig | null = cfg.uazapi_token && cfg.uazapi_base_url
    ? { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }
    : null

  const nomeMembro = conversa.nome_contato || contexto?.nome_membro || "irmão(ã)"
  const fluxoAtivo = fluxo || "pastoral"

  // ── Primeiro contato: envia mensagem interativa + salva no DB ──────────────
  if (primeiro_contato && uazapiCfg) {
    await sendFlowOpener(uazapiCfg, conversa.telefone, fluxoAtivo, nomeMembro, contexto?.escala_info)

    const textoAbertura = `[Mensagem interativa enviada — fluxo: ${fluxoAtivo}]`
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id, direcao: "saida", conteudo: textoAbertura, tipo: fluxoAtivo === "escala" ? "botoes" : "lista", ia_gerada: true, status: "enviado",
    })
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: textoAbertura, ultima_msg_at: new Date().toISOString(), ia_ativa: true,
    }).eq("id", conversa_id)

    return NextResponse.json({ ok: true, tipo: "abertura_interativa" })
  }

  // ── Conversa em andamento: OpenAI gera resposta ────────────────────────────
  const hist = (historico ?? []).filter((m: any) => !m.conteudo?.startsWith("[Mensagem interativa"))
  const systemPrompt = buildSystemPrompt(fluxoAtivo, cfg, { nome_membro: nomeMembro, nome_igreja: igrejaNome, ...contexto })

  const messages = [
    { role: "system", content: systemPrompt },
    ...hist.map((m: any) => ({
      role: m.direcao === "saida" ? "assistant" : "user",
      content: m.conteudo,
    })),
  ]

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.openai_api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.openai_model || "gpt-4o-mini", messages, max_tokens: 500, temperature: 0.75 }),
    signal: AbortSignal.timeout(30000),
  })

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => ({}))
    return NextResponse.json({ error: err.error?.message ?? "Erro na OpenAI" }, { status: 502 })
  }

  const openaiJson  = await openaiRes.json()
  const respostaRaw: string = openaiJson.choices?.[0]?.message?.content ?? ""

  // Extrai resumo e alerta internos
  let resumo: string | null = null
  let alerta: string | null = null
  let categoriaAlerta = "pastoral"

  const resumoIdx = respostaRaw.indexOf("RESUMO_SDR:")
  const alertaIdx = respostaRaw.indexOf("ALERTA_PASTORAL:")
  if (resumoIdx !== -1) resumo = respostaRaw.substring(resumoIdx + 11).split("\n")[0].trim()
  if (alertaIdx !== -1) {
    alerta = respostaRaw.substring(alertaIdx + 16).split("\n")[0].trim()
    if (alerta.includes("financeiro")) categoriaAlerta = "financeiro"
    else if (alerta.includes("casamento")) categoriaAlerta = "casamento"
    else if (alerta.includes("saude")) categoriaAlerta = "saude"
  }

  const resposta = respostaRaw
    .replace(resumoIdx !== -1 ? respostaRaw.substring(resumoIdx) : "", "")
    .replace(alertaIdx !== -1 ? respostaRaw.substring(alertaIdx) : "", "")
    .trim()

  // Salva resumo
  if (resumo) {
    await (supabase as any).from("conversas_whatsapp").update({ resumo_ia: resumo }).eq("id", conversa_id)
  }

  // Envia alertas para pastores
  if (alerta && uazapiCfg) {
    const numeros: any[] = cfg.numeros_notificacao ?? []
    const destinatarios = numeros.filter((n: any) => n.categoria === "geral" || n.categoria === categoriaAlerta)
    const alertaMsg = `🚨 *ALERTA PASTORAL — ${igrejaNome}*\n\n*Categoria:* ${categoriaAlerta}\n*Membro:* ${nomeMembro}\n*Tel:* ${conversa.telefone}\n*Detalhe:* ${alerta}`

    for (const dest of destinatarios) {
      try { await sendText(uazapiCfg, dest.telefone, alertaMsg) } catch { /* não bloqueia */ }
    }
  }

  // Envia resposta via WhatsApp
  if (resposta && uazapiCfg) {
    try { await sendText(uazapiCfg, conversa.telefone, resposta) } catch { /* log silencioso */ }
  }

  // Salva no DB
  if (resposta) {
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id, direcao: "saida", conteudo: resposta, ia_gerada: true, status: uazapiCfg ? "enviado" : "pendente",
    })
    await (supabase as any).from("conversas_whatsapp").update({
      ultima_mensagem: resposta, ultima_msg_at: new Date().toISOString(),
    }).eq("id", conversa_id)
  }

  return NextResponse.json({ resposta, resumo, alerta })
}
