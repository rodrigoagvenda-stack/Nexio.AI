import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { sendText, sendList, sendButtons, sendLocation, rejectCall, UazapiConfig, parseWebhookPayload } from "@/lib/uazapi"

// ─── Constantes ───────────────────────────────────────────────────────────────

const MENU_CHOICES = [
  "[Como posso ajudar?]",
  "🙏 Pedido de oração|oracao|Quero pedir intercessão",
  "💰 Ajuda financeira|financeiro|Preciso de apoio",
  "💍 Aconselhamento|casamento|Questões conjugais ou familiares",
  "📖 Estudo bíblico|estudo|Quero crescer na Palavra",
  "📍 Endereço da igreja|endereco|Onde fica a igreja?",
  "[Estou bem]",
  "😊 Não preciso de nada|bem|Obrigado!",
]

const IGREJAS = {
  sede: {
    nome: "Templo Sede — Bairro Flamengo",
    address: "Av. Rosa Cruz, 200 — Flamengo, Vitória da Conquista — BA, 45005-362",
    lat: -14.8552,
    lng: -40.8250,
    cultos: "Segunda, Quarta, Sexta e Domingo",
  },
  congregacao: {
    nome: "Congregação Cidade Modelo",
    address: "R. I, 625 — Cidade Modelo, Vitória da Conquista — BA",
    lat: -14.8750,
    lng: -40.8300,
    cultos: "Terça (Sã Doutrina), Quinta e Domingo",
  },
}

// ─── Helpers comuns ───────────────────────────────────────────────────────────

async function saveCtx(supabase: any, conversaId: string, ctx: any, novoCtx: any, novoStep: string) {
  await (supabase as any).from("conversas_whatsapp").update({
    contexto: { ...ctx, ...novoCtx }, tipo_fluxo: novoStep,
  }).eq("id", conversaId)
}

async function salvarMensagem(supabase: any, conversaId: string, conteudo: string) {
  await (supabase as any).from("mensagens_whatsapp").insert({
    conversa_id: conversaId, direcao: "saida", conteudo, ia_gerada: true, status: "enviado",
  })
  await (supabase as any).from("conversas_whatsapp").update({
    ultima_mensagem: conteudo, ultima_msg_at: new Date().toISOString(),
  }).eq("id", conversaId)
}

async function enviarMenu(uazapi: UazapiConfig, numero: string, nome: string, txt?: string) {
  await sendList(uazapi, numero, {
    text: txt || `Posso ajudar com mais alguma coisa, ${nome}? 😊`,
    listButton: "Ver opções",
    choices: MENU_CHOICES,
    footer: "Nossa equipe pastoral está aqui por você ❤️",
  })
}

async function resetarFluxo(supabase: any, conversaId: string) {
  await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: "pastoral", contexto: {} }).eq("id", conversaId)
}

async function notificarNumeros(uazapi: UazapiConfig, cfg: any, categorias: string[], mensagem: string) {
  const numeros: any[] = cfg.numeros_notificacao ?? []
  const destinatarios = numeros.filter((n: any) => categorias.includes(n.categoria) || n.categoria === "geral")
  for (const dest of destinatarios) {
    try { await sendText(uazapi, dest.telefone, mensagem) } catch { /* silencioso */ }
  }
}

// ─── State machine: ORAÇÃO ────────────────────────────────────────────────────

async function handleOracao(
  supabase: any, uazapi: UazapiConfig, cfg: any,
  conversa: any, fromNumber: string, text: string, selecao: string,
  igrejaCfg: any,
): Promise<boolean> {
  const step       = conversa.tipo_fluxo || "oracao"
  const ctx        = conversa.contexto   || {}
  const igrejaNome = igrejaCfg.nome || "nossa Igreja"
  const convId     = conversa.id

  const AREAS_ORACAO = [
    "🏥 Saúde|saude",
    "👨‍👩‍👧 Família|familia",
    "💼 Trabalho/Emprego|trabalho",
    "💰 Financeiro|financeiro",
    "🕊️ Espiritual/Fé|espiritual",
    "💍 Relacionamento/Casamento|relacionamento",
    "📝 Outra área|outra_area",
  ]

  // STEP 0: Início — duas mensagens separadas
  if (step === "oracao") {
    await saveCtx(supabase, convId, ctx, {}, "or_nome")
    await sendText(uazapi, fromNumber, "Para registrar seu pedido de oração, precisamos de algumas informações. 🙏")
    await sendText(uazapi, fromNumber, "Qual é o seu *nome completo*?")
    await salvarMensagem(supabase, convId, "[Inicio fluxo oração]")
    return true
  }

  // STEP 1: Nome recebido → botões de área
  if (step === "or_nome") {
    const nome = text.trim()
    await saveCtx(supabase, convId, ctx, { nome }, "or_area")
    await sendText(uazapi, fromNumber, `Obrigado, ${nome}! 🙏`)
    await sendButtons(uazapi, fromNumber, {
      text: "Agora, escolha o *motivo* do seu pedido de oração:",
      choices: AREAS_ORACAO,
      footer: "Selecione uma área",
    })
    await salvarMensagem(supabase, convId, `[Botões: área da oração]`)
    return true
  }

  // STEP 2: Área recebida
  if (step === "or_area") {
    const area = selecao || text.toLowerCase().trim()
    if (area === "outra_area") {
      await saveCtx(supabase, convId, ctx, { area: "outro" }, "or_descricao")
      await sendText(uazapi, fromNumber, "Pode descrever o motivo da oração de forma *objetiva*? 📝\n\n_(Texto ou áudio — outros tipos de mídia não são aceitos neste fluxo)_")
      await salvarMensagem(supabase, convId, "[Pedindo descrição livre]")
    } else {
      const areaMap: Record<string, string> = {
        saude: "Saúde", familia: "Família", trabalho: "Trabalho/Emprego",
        financeiro: "Financeiro", espiritual: "Espiritual/Fé", relacionamento: "Relacionamento",
      }
      const areaLabel = areaMap[area] || text.trim()
      await saveCtx(supabase, convId, ctx, { area: areaLabel }, "or_para")
      await sendButtons(uazapi, fromNumber, {
        text: `*${areaLabel}* — anotado! 🙏\n\nEssa oração é *para você* ou para um *ente querido*?`,
        choices: ["Para mim mesmo|para_mim", "Para outra pessoa|para_outro"],
      })
      await salvarMensagem(supabase, convId, "[Botões: para quem é a oração]")
    }
    return true
  }

  // STEP 2b: Descrição livre (outra área)
  if (step === "or_descricao") {
    // Ignora mídia que não é texto
    const tipoMsg = conversa._tipoMsg
    if (tipoMsg && tipoMsg !== "texto" && tipoMsg !== "audio") {
      await sendText(uazapi, fromNumber, "Desculpe, mas só processo *texto ou áudio* aqui. 😊\n\nPode me descrever o motivo em poucas palavras?")
      return true
    }
    await saveCtx(supabase, convId, ctx, { area: text.trim() }, "or_para")
    await sendButtons(uazapi, fromNumber, {
      text: `Entendido! 🙏\n\nEssa oração é *para você* ou para um *ente querido*?`,
      choices: ["Para mim mesmo|para_mim", "Para outra pessoa|para_outro"],
    })
    await salvarMensagem(supabase, convId, "[Botões: para quem é a oração]")
    return true
  }

  // STEP 3: Para quem?
  if (step === "or_para") {
    const resp = selecao || text.toLowerCase()
    const paraMim = resp.includes("para_mim") || resp.includes("mim") || resp.includes("eu")
    if (!paraMim) {
      await saveCtx(supabase, convId, ctx, { para: "outro" }, "or_nome_outro")
      await sendText(uazapi, fromNumber, "Qual é o nome da pessoa pela qual você está pedindo oração?")
      await salvarMensagem(supabase, convId, "[Pedindo nome do ente querido]")
    } else {
      await saveCtx(supabase, convId, ctx, { para: "mim" }, "or_registro")
      await registrarOracao(supabase, uazapi, cfg, conversa, fromNumber, { ...ctx, para: "mim" }, igrejaCfg)
    }
    return true
  }

  // STEP 3b: Nome do ente querido
  if (step === "or_nome_outro") {
    await saveCtx(supabase, convId, ctx, { nome_ente: text.trim() }, "or_registro")
    await registrarOracao(supabase, uazapi, cfg, conversa, fromNumber, { ...ctx, nome_ente: text.trim(), para: "outro" }, igrejaCfg)
    return true
  }

  return false
}

async function registrarOracao(
  supabase: any, uazapi: UazapiConfig, cfg: any,
  conversa: any, fromNumber: string, ctx: any, igrejaCfg: any,
) {
  const igrejaNome = igrejaCfg.nome || "Igreja"
  const nome       = ctx.nome || conversa.nome_contato || "Irmão(ã)"
  const area       = ctx.area || "Não especificado"
  const paraTxt    = ctx.para === "outro" ? (ctx.nome_ente || "ente querido") : "próprio solicitante"

  // Busca membro pelo telefone
  const { data: membro } = await (supabase as any).from("membros").select("id")
    .ilike("telefone", `%${fromNumber.slice(-9)}%`).eq("igreja_id", igrejaCfg.id).maybeSingle()

  // Salva pedido de oração
  const { data: pedido, error } = await (supabase as any).from("pedidos_oracao").insert({
    membro_id: membro?.id ?? null,
    titulo: `Pedido de ${nome}`,
    descricao: `Área: ${area}. Para: ${paraTxt}.`,
    categoria: mapearCategoria(area),
    status: "ativo",
    privacidade: "lideranca",
    data_pedido: new Date().toISOString(),
  }).select("id").single()

  if (error) console.error("[or] insert error:", error.message)
  else console.log("[or] pedido registrado:", pedido?.id)

  // Confirma ao membro
  await sendText(uazapi, fromNumber, `Amém! 🙏 Seu pedido de oração foi registrado com sucesso.\n\nJá estamos intercedendo por *${area}*. Que o Senhor te abençoe grandemente! ❤️`)
  await salvarMensagem(supabase, conversa.id, "[Confirmação de oração enviada]")

  // Notifica responsáveis com botão de autorização para grupo
  const pedidoId = pedido?.id ?? ""
  const msgPastor = `🙏 *PEDIDO DE ORAÇÃO — ${igrejaNome}*\n\n*${nome}* solicitou um pedido de oração pela área de *${area}*${ctx.para === "outro" ? ` em prol de ${ctx.nome_ente}` : ""}.\n\nPosso confirmar e compartilhar no Grupo da Igreja?`

  const numeros: any[] = cfg.numeros_notificacao ?? []
  const pastores = numeros.filter((n: any) => n.categoria === "geral" || n.categoria === "pastoral")
  for (const dest of pastores) {
    try {
      await sendButtons(uazapi, dest.telefone, {
        text: msgPastor,
        choices: [`✅ Sim, compartilhar no grupo|autorizar_oracao_${pedidoId}`, "❌ Não compartilhar|nao_compartilhar"],
        footer: `Pedido de ${nome}`,
      })
    } catch { /* silencioso */ }
  }

  // Reset + menu
  await resetarFluxo(supabase, conversa.id)
  try { await enviarMenu(uazapi, fromNumber, nome) } catch { /* silencioso */ }
}

function mapearCategoria(area: string): string {
  const a = area.toLowerCase()
  if (a.includes("saúde") || a.includes("saude")) return "saude"
  if (a.includes("família") || a.includes("familia")) return "familia"
  if (a.includes("trabalho") || a.includes("emprego")) return "trabalho"
  if (a.includes("financeiro") || a.includes("dinheiro")) return "financeiro"
  if (a.includes("espiritual") || a.includes("fé") || a.includes("fe")) return "espiritual"
  return "outro"
}

// ─── State machine: ASSISTÊNCIA FINANCEIRA ────────────────────────────────────

async function handleFinanceiro(
  supabase: any, uazapi: UazapiConfig, cfg: any,
  conversa: any, fromNumber: string, text: string, selecao: string,
  igrejaCfg: any,
): Promise<boolean> {
  const step       = conversa.tipo_fluxo || "financeiro"
  const ctx        = conversa.contexto   || {}
  const igrejaNome = igrejaCfg.nome || "nossa Igreja"
  const convId     = conversa.id

  if (step === "financeiro") {
    await saveCtx(supabase, convId, ctx, {}, "fin_nome")
    await sendText(uazapi, fromNumber, "Precisamos de algumas informações para ajudar você. 💛")
    await sendText(uazapi, fromNumber, "Qual é o seu *nome completo*?")
    await salvarMensagem(supabase, convId, "[Início fluxo financeiro]")
    return true
  }

  if (step === "fin_nome") {
    await saveCtx(supabase, convId, ctx, { nome: text.trim() }, "fin_para")
    await sendButtons(uazapi, fromNumber, {
      text: `Obrigado, ${text.trim()}! 😊\n\nEssa necessidade é *para você* ou para *outra pessoa*?`,
      choices: ["Para mim|para_mim", "Para outra pessoa|para_outro"],
    })
    await salvarMensagem(supabase, convId, "[Botões: para mim / outra pessoa]")
    return true
  }

  if (step === "fin_para") {
    const resp = selecao || text.toLowerCase()
    if (resp.includes("outro") || resp.includes("para_outro") || resp.includes("outra")) {
      await saveCtx(supabase, convId, ctx, { para: "outro" }, "fin_nome_outro")
      await sendText(uazapi, fromNumber, "Qual é o nome da pessoa que precisa de ajuda?")
    } else {
      await saveCtx(supabase, convId, ctx, { para: "mim" }, "fin_tipo")
      await sendButtons(uazapi, fromNumber, {
        text: "Que tipo de ajuda você precisa?",
        choices: ["🛒 Cesta básica|cesta_basica","🔥 Gás de cozinha|gas","🏠 Aluguel/moradia|aluguel","💊 Remédio|remedio","📝 Outro|outro"],
        footer: "Selecione uma opção",
      })
      await salvarMensagem(supabase, convId, "[Botões: tipo de ajuda]")
    }
    return true
  }

  if (step === "fin_nome_outro") {
    await saveCtx(supabase, convId, ctx, { nome_beneficiario: text.trim() }, "fin_tipo")
    await sendButtons(uazapi, fromNumber, {
      text: `Entendido! Que tipo de ajuda *${text.trim()}* precisa?`,
      choices: ["🛒 Cesta básica|cesta_basica","🔥 Gás de cozinha|gas","🏠 Aluguel/moradia|aluguel","💊 Remédio|remedio","📝 Outro|outro"],
      footer: "Selecione uma opção",
    })
    await salvarMensagem(supabase, convId, "[Botões: tipo de ajuda]")
    return true
  }

  if (step === "fin_tipo") {
    const tipoMap: Record<string,string> = { cesta_basica:"Cesta básica", gas:"Gás de cozinha", aluguel:"Aluguel/moradia", remedio:"Remédio", outro:"Outro" }
    const tipoLabel = tipoMap[selecao || text.toLowerCase().trim()] || text.trim()
    await saveCtx(supabase, convId, ctx, { tipo_ajuda: tipoLabel }, "fin_endereco")
    await sendText(uazapi, fromNumber, `*${tipoLabel}* anotado! 📝\n\nPara cadastrar o pedido, preciso do seu *endereço completo* (rua, número, bairro e cidade).`)
    return true
  }

  if (step === "fin_endereco") {
    const finalCtx = { ...ctx, endereco: text.trim() }
    const { data: membro } = await (supabase as any).from("membros").select("id")
      .ilike("telefone", `%${fromNumber.slice(-9)}%`).eq("igreja_id", igrejaCfg.id).maybeSingle()

    const { data: pedido, error: insertErr } = await (supabase as any).from("pedidos_assistencia").insert({
      igreja_id: igrejaCfg.id, membro_id: membro?.id ?? null,
      nome: finalCtx.nome, telefone: fromNumber,
      para: finalCtx.para || "mim", nome_beneficiario: finalCtx.nome_beneficiario || null,
      tipo_ajuda: finalCtx.tipo_ajuda, endereco: finalCtx.endereco, status: "pendente",
    }).select("id").single()

    if (insertErr) console.error("[fin] insert:", insertErr.message)
    else console.log("[fin] pedido assistência salvo:", pedido?.id)

    // Confirmação
    await sendText(uazapi, fromNumber, `✅ Pedido registrado com sucesso!\n\nNossa equipe irá analisar e entrar em contato em breve. Que Deus proveja! 🙏`)
    await salvarMensagem(supabase, convId, "[Confirmação de assistência enviada]")

    // Notifica responsáveis com botão para compartilhar no grupo (sem citar nome)
    const pedidoId = pedido?.id ?? ""
    const msgPastor = `💰 *PEDIDO DE ASSISTÊNCIA — ${igrejaNome}*\n\n*Nome:* ${finalCtx.nome}\n*Tel:* ${fromNumber}\n*Para:* ${finalCtx.para === "outro" ? finalCtx.nome_beneficiario : "próprio solicitante"}\n*Tipo:* ${finalCtx.tipo_ajuda}\n*Endereço:* ${finalCtx.endereco}\n\nDeseja compartilhar uma campanha de arrecadação no grupo? *(o nome do irmão não será divulgado)*`

    const numeros: any[] = cfg.numeros_notificacao ?? []
    const pastores = numeros.filter((n: any) => n.categoria === "geral" || n.categoria === "financeiro")
    for (const dest of pastores) {
      try {
        await sendButtons(uazapi, dest.telefone, {
          text: msgPastor,
          choices: [`✅ Sim, compartilhar no grupo|autorizar_financeiro_${pedidoId}`, "❌ Não compartilhar|nao_compartilhar"],
          footer: `Pedido de ${finalCtx.nome}`,
        })
      } catch { console.error("[fin] notificação:", dest.telefone) }
    }

    await resetarFluxo(supabase, convId)
    try { await enviarMenu(uazapi, fromNumber, finalCtx.nome) } catch { /* silencioso */ }
    return true
  }

  return false
}

// ─── System Prompt: Aconselhamento ───────────────────────────────────────────

function buildAconselhamentoPrompt(igrejaNome: string, assistente: string): string {
  return `## IDENTIDADE
Você é ${assistente}, assistente pastoral virtual da ${igrejaNome}.
Você não é uma IA genérica. Você é uma representante da igreja, com amor, cuidado e discrição.
Seu tom é acolhedor, empático e direto — nunca frio, nunca invasivo.

---
## ORDEM DE EXECUÇÃO (siga SEMPRE nessa ordem)

Para CADA mensagem recebida:
1. Leia TODO o histórico antes de responder
2. Identifique em qual etapa da coleta você está
3. Verifique o que JÁ foi coletado — NUNCA repita uma pergunta já respondida
4. Faça UMA pergunta por vez
5. Avance para a próxima etapa somente após a atual estar concluída

---
## CHECKLIST DE COLETA (aconselhamento)

[ ] Nome completo coletado?
[ ] Nome do cônjuge/familiar coletado? (opcional — respeite se não quiser informar)
[ ] Situação/motivo coletado?

Só avance para o próximo item após o anterior estar confirmado no histórico.

---
## FLUXO OBRIGATÓRIO

ETAPA 1 — Nome:
→ "Estamos aqui para ajudar com muito amor e sem julgamentos. 💙"
→ (mensagem separada) "Qual é o seu nome completo?"

ETAPA 2 — Cônjuge/familiar (após receber o nome):
→ "Obrigado, [nome]."
→ (mensagem separada) "Pode me informar o nome do cônjuge ou familiar envolvido? Pode pular se preferir."

ETAPA 3 — Situação (após etapa 2):
→ "O que trouxe você até nós? Pode me contar brevemente sobre a situação."

ETAPA 4 — Encerramento (após coletar as 3 informações):
→ Responda SOMENTE com:
DADOS_ACONSELHAMENTO: {"nome":"...","nome_conjuge":"...","motivo":"..."}

---
## REGRAS ABSOLUTAS

- NUNCA repita uma pergunta que já foi respondida — consulte o histórico
- UMA pergunta por mensagem
- MÁXIMO 3 linhas por mensagem
- Cada frase em linha separada — escreva como WhatsApp, não como e-mail
- NUNCA compartilhe informações de aconselhamento com terceiros ou grupos
- NUNCA exponha o nome ou situação da pessoa de forma alguma
- Seja discreto e confidencial em todo momento
- Se a pessoa enviar mídia (áudio/imagem): aceite áudio, transcreva mentalmente e continue. Para imagens/documentos: "Desculpe, aqui só processo texto ou áudio. 😊"

---
## FORMATAÇÃO

CERTO:
"Entendido."
"Pode me contar um pouco mais sobre a situação?"

ERRADO:
"Entendido! Pode me contar um pouco mais sobre a situação que você está enfrentando no seu casamento ou relacionamento familiar?"

ZERO markdown. ZERO listas. ZERO emojis excessivos. Máximo um emoji por mensagem.`
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(apiKey: string, model: string, system: string, historico: any[]): Promise<string> {
  const messages = [
    { role: "system", content: system },
    ...historico.filter((m: any) => !m.conteudo?.startsWith("[")).slice(-20)
      .map((m: any) => ({ role: m.direcao === "saida" ? "assistant" : "user", content: m.conteudo })),
  ]
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: model || "gpt-4.1-mini", messages, max_tokens: 300, temperature: 0.5 }),
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) { console.error("[OpenAI]", res.status, await res.text().catch(() => "")); return "" }
  return (await res.json()).choices?.[0]?.message?.content ?? ""
}

// ─── Aconselhamento: processa dados completos ─────────────────────────────────

async function processarAconselhamento(
  supabase: any, uazapi: UazapiConfig, cfg: any,
  conversa: any, resposta: string, igrejaNome: string, igrejaId: string,
): Promise<boolean> {
  const idx = resposta.indexOf("DADOS_ACONSELHAMENTO:")
  if (idx === -1) return false
  try {
    const json = JSON.parse(resposta.substring(idx + 21).trim())
    const msg  = `💍 *PEDIDO DE ACONSELHAMENTO — ${igrejaNome}*\n\n*Nome:* ${json.nome}\n*Envolvido(a):* ${json.nome_conjuge || "Não informado"}\n*Situação:* ${json.motivo}\n\n⚠️ _Informação CONFIDENCIAL — não compartilhar com o grupo_`
    await notificarNumeros(uazapi, cfg, ["pastoral", "casamento"], msg)
    await sendText(uazapi, conversa.telefone, `Obrigado pela confiança, ${json.nome}. ❤️\n\nSeu pedido foi encaminhado ao pastor responsável com total sigilo. Ele entrará em contato em breve. Você não está sozinho(a)!`)
    await resetarFluxo(supabase, conversa.id)
    try { await enviarMenu(uazapi, conversa.telefone, json.nome) } catch { /* silencioso */ }
    return true
  } catch (e) { console.error("[aconselhamento] parse:", e); return false }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: any = {}
  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  const eventType = (body?.EventType ?? body?.event ?? body?.type ?? "").toLowerCase()
  console.log(`[webhook] event="${eventType}" inst="${body?.instanceName ?? ""}"`)

  // ── Chamadas de voz ──────────────────────────────────────────────────────────
  if (eventType.includes("call")) {
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

  if (eventType && !eventType.includes("message")) {
    return NextResponse.json({ ok: true, skipped: eventType })
  }

  const parsed = parseWebhookPayload(body)
  if (!parsed) return NextResponse.json({ ok: true })

  const { fromNumber, text, msgId, pushName, instanceName } = parsed
  const selecao    = body?.message?.buttonOrListid || ""
  const tipoMsg    = body?.message?.type || "text"  // para detectar áudio/imagem
  const fotoUrl    = body?.chat?.imagePreview || ""
  console.log(`[webhook] de=${fromNumber} texto="${text.substring(0,40)}" sel="${selecao}" tipo="${tipoMsg}"`)

  try {
    const supabase = createServiceClient()

    // Deduplicação
    if (msgId) {
      const { data: ja } = await (supabase as any).from("mensagens_whatsapp").select("id").eq("msg_id_wpp", msgId).maybeSingle()
      if (ja) { console.log("[webhook] duplicado, ignorando"); return NextResponse.json({ ok: true }) }
    }

    // Busca igrejas
    const { data: igrejas } = await (supabase as any).from("igrejas").select("id, nome, configuracoes")
    if (!igrejas?.length) return NextResponse.json({ ok: false, error: "nenhuma igreja" })

    const igrejaCfg =
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_instance?.toLowerCase() === (instanceName ?? "").toLowerCase()) ??
      igrejas.find((ig: any) => ig.configuracoes?.uazapi_token)
    if (!igrejaCfg) return NextResponse.json({ ok: false })

    const cfg    = igrejaCfg.configuracoes ?? {}
    const uazapi: UazapiConfig = { base_url: cfg.uazapi_base_url, token: cfg.uazapi_token }
    console.log(`[webhook] ${igrejaCfg.nome} | uazapi:${uazapi.token?"ok":"MISS"} | openai:${cfg.openai_api_key?"ok":"MISS"}`)

    // ── Verifica se é resposta de autorização do pastor ──────────────────────
    if (selecao.startsWith("autorizar_oracao_")) {
      const pedidoId = selecao.replace("autorizar_oracao_", "")
      const grupoId  = cfg.grupo_whatsapp_id
      if (grupoId && pedidoId) {
        const { data: pedido } = await (supabase as any).from("pedidos_oracao").select("titulo, descricao").eq("id", pedidoId).single()
        if (pedido) {
          const msgGrupo = `🙏 *Pedido de Oração*\n\nIrmãos, temos um pedido de intercessão na nossa família!\n\n${pedido.descricao || pedido.titulo}\n\nOremos juntos! 🙌`
          try { await sendText(uazapi, grupoId, msgGrupo); await sendText(uazapi, fromNumber, "✅ Pedido compartilhado no grupo!") } catch { /* silencioso */ }
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (selecao.startsWith("autorizar_financeiro_")) {
      const pedidoId = selecao.replace("autorizar_financeiro_", "")
      const grupoId  = cfg.grupo_whatsapp_id
      if (grupoId) {
        const msgGrupo = `🌟 *A paz do Senhor, amados!* 🌟\n\nPrecisamos da colaboração de vocês! Um irmão(ã) de nossa congregação está passando por um momento de necessidade.\n\nVamos ser a mão de Deus e ajudar como cada um puder! Entre em contato com a liderança.\n\n_"Melhor é o que dá do que o que recebe."_ — Atos 20:35 🙏`
        try { await sendText(uazapi, grupoId, msgGrupo); await sendText(uazapi, fromNumber, "✅ Campanha compartilhada no grupo!") } catch { /* silencioso */ }
      }
      return NextResponse.json({ ok: true })
    }

    if (selecao === "nao_compartilhar") {
      try { await sendText(uazapi, fromNumber, "✅ Entendido! O pedido não será compartilhado no grupo.") } catch { /* silencioso */ }
      return NextResponse.json({ ok: true })
    }

    // Busca ou cria conversa
    let { data: conversa } = await (supabase as any)
      .from("conversas_whatsapp")
      .select("id, nome_contato, ia_ativa, tipo_fluxo, nao_lidas, telefone, contexto, foto_url")
      .eq("telefone", fromNumber).eq("igreja_id", igrejaCfg.id)
      .neq("status", "encerrada").maybeSingle()

    if (!conversa) {
      const { data: membro } = await (supabase as any).from("membros").select("id, nome")
        .ilike("telefone", `%${fromNumber.slice(-9)}%`).eq("igreja_id", igrejaCfg.id).maybeSingle()
      const nome = membro?.nome ?? pushName ?? fromNumber
      const { data: nova } = await (supabase as any).from("conversas_whatsapp")
        .insert({ igreja_id: igrejaCfg.id, telefone: fromNumber, nome_contato: nome, ia_ativa: true, tipo_fluxo: "pastoral", contexto: {}, status: "aberta", foto_url: fotoUrl || null })
        .select().single()
      conversa = nova
    } else {
      if (!conversa.ia_ativa) {
        await (supabase as any).from("conversas_whatsapp").update({ ia_ativa: true }).eq("id", conversa.id)
        conversa.ia_ativa = true
      }
      // Atualiza foto se disponível
      if (fotoUrl && !conversa.foto_url) {
        await (supabase as any).from("conversas_whatsapp").update({ foto_url: fotoUrl }).eq("id", conversa.id)
      }
    }
    if (!conversa) return NextResponse.json({ ok: false })

    // Passa tipo de mensagem no contexto temporário
    conversa._tipoMsg = tipoMsg

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

    // ── FLUXO FINANCEIRO ─────────────────────────────────────────────────────
    const isFinStep = step === "financeiro" || step.startsWith("fin_")
    if (isFinStep || selecao === "financeiro") {
      if (selecao === "financeiro") { conversa.tipo_fluxo = "financeiro"; conversa.contexto = {} }
      await handleFinanceiro(supabase, uazapi, cfg, conversa, fromNumber, text, selecao, igrejaCfg)
      return NextResponse.json({ ok: true })
    }

    // ── FLUXO ORAÇÃO ─────────────────────────────────────────────────────────
    const isOrStep = step === "oracao" || step.startsWith("or_")
    if (isOrStep || selecao === "oracao") {
      if (selecao === "oracao") { conversa.tipo_fluxo = "oracao"; conversa.contexto = {} }
      await handleOracao(supabase, uazapi, cfg, conversa, fromNumber, text, selecao, igrejaCfg)
      return NextResponse.json({ ok: true })
    }

    // ── ESTUDO BÍBLICO ───────────────────────────────────────────────────────
    if (selecao === "estudo") {
      await resetarFluxo(supabase, conversa.id)
      const nome = conversa.nome_contato?.split(" ")[0] || "irmão(ã)"
      const convite = `Que lindo, ${nome}! 🙌🔥\n\nA Palavra de Deus nos diz:\n_"E conhecereis a verdade, e a verdade vos libertará."_ — João 8:32\n\nE também: _"Crescei na graça e no conhecimento de nosso Senhor e Salvador Jesus Cristo."_ — 2 Pedro 3:18\n\nTer uma base sólida na Palavra é tudo! 🕊️`
      await sendText(uazapi, fromNumber, convite)
      await sendButtons(uazapi, fromNumber, {
        text: "Qual unidade fica mais perto de você?",
        choices: ["🏛️ Panorama (Templo Sede)|estudo_sede","⛪ Cidade Modelo (Congregação)|estudo_congregacao"],
      })
      await salvarMensagem(supabase, conversa.id, convite)
      return NextResponse.json({ ok: true })
    }

    if (selecao === "estudo_sede") {
      await resetarFluxo(supabase, conversa.id)
      const msg = `Te esperamos no *Templo Sede — Bairro Flamengo*! 🙌\n\n📅 *Culto de Sã Doutrina:* toda Segunda-feira às 19h\n📅 *Outros cultos:* Quarta, Sexta e Domingo\n\nAbaixo deixo a nossa localização 📍`
      await sendText(uazapi, fromNumber, msg)
      try { await sendLocation(uazapi, fromNumber, { name: `${igrejaCfg.nome} — Templo Sede`, address: IGREJAS.sede.address, latitude: IGREJAS.sede.lat, longitude: IGREJAS.sede.lng }) } catch { /* silencioso */ }
      await salvarMensagem(supabase, conversa.id, msg)
      return NextResponse.json({ ok: true })
    }

    if (selecao === "estudo_congregacao") {
      await resetarFluxo(supabase, conversa.id)
      const msg = `Te esperamos na *Congregação Cidade Modelo*! 🙌\n\n📅 *Culto de Sã Doutrina:* toda Terça-feira às 19h\n📅 *Outros cultos:* Quinta e Domingo\n\nAbaixo deixo a nossa localização 📍`
      await sendText(uazapi, fromNumber, msg)
      try { await sendLocation(uazapi, fromNumber, { name: `${igrejaCfg.nome} — Congregação`, address: IGREJAS.congregacao.address, latitude: IGREJAS.congregacao.lat, longitude: IGREJAS.congregacao.lng }) } catch { /* silencioso */ }
      await salvarMensagem(supabase, conversa.id, msg)
      return NextResponse.json({ ok: true })
    }

    // ── ENDEREÇO ─────────────────────────────────────────────────────────────
    if (selecao === "endereco") {
      await sendButtons(uazapi, fromNumber, {
        text: "Qual endereço você precisa?",
        choices: ["🏛️ Templo Sede — Flamengo|sede","⛪ Congregação — Cidade Modelo|congregacao"],
      })
      await salvarMensagem(supabase, conversa.id, "[Botões: endereço]")
      return NextResponse.json({ ok: true })
    }

    if (selecao === "sede") {
      const msg = `📍 *Templo Sede — Bairro Flamengo*\n\n${IGREJAS.sede.address}\n\n🗓️ *Cultos:* ${IGREJAS.sede.cultos}\n\nAbaixo deixo a localização no mapa 👇`
      await sendText(uazapi, fromNumber, msg)
      try { await sendLocation(uazapi, fromNumber, { name: `${igrejaCfg.nome} — Templo Sede`, address: IGREJAS.sede.address, latitude: IGREJAS.sede.lat, longitude: IGREJAS.sede.lng }) } catch { /* silencioso */ }
      await salvarMensagem(supabase, conversa.id, msg)
      return NextResponse.json({ ok: true })
    }

    if (selecao === "congregacao") {
      const msg = `📍 *Congregação Cidade Modelo*\n\n${IGREJAS.congregacao.address}\n\n🗓️ *Cultos:* ${IGREJAS.congregacao.cultos}\n\nAbaixo deixo a localização no mapa 👇`
      await sendText(uazapi, fromNumber, msg)
      try { await sendLocation(uazapi, fromNumber, { name: `${igrejaCfg.nome} — Congregação`, address: IGREJAS.congregacao.address, latitude: IGREJAS.congregacao.lat, longitude: IGREJAS.congregacao.lng }) } catch { /* silencioso */ }
      await salvarMensagem(supabase, conversa.id, msg)
      return NextResponse.json({ ok: true })
    }

    // ── BEM ──────────────────────────────────────────────────────────────────
    if (selecao === "bem") {
      const resp = `Que bênção! 😊🙌 Continue firme na fé! Nossa porta está sempre aberta. Que Deus te abençoe! ❤️`
      await sendText(uazapi, fromNumber, resp)
      await salvarMensagem(supabase, conversa.id, resp)
      return NextResponse.json({ ok: true })
    }

    // ── ACONSELHAMENTO (OpenAI) ── primeira seleção: mensagem hardcoded ──────
    if (selecao === "casamento") {
      await (supabase as any).from("conversas_whatsapp").update({ tipo_fluxo: "casamento", contexto: {} }).eq("id", conversa.id)
      await sendText(uazapi, fromNumber, "Estamos aqui para ajudar com muito amor e sem julgamentos. 💙")
      await sendText(uazapi, fromNumber, "Qual é o seu *nome completo*?")
      await salvarMensagem(supabase, conversa.id, "[Início fluxo aconselhamento]")
      return NextResponse.json({ ok: true })
    }

    // ── SAUDAÇÕES / MENU ──────────────────────────────────────────────────────
    const GRATIDAO  = ["obrigado","obrigada","valeu","muito obrigado","muito obrigada","obg","obrigada!","obrigado!"]
    const SAUDACOES = ["olá","ola","oi","oi!","menu","inicio","início","bom dia","boa tarde","boa noite","voltar","paz"]
    const textNorm  = text.toLowerCase().trim().replace(/[!.?]+$/,"")

    if (GRATIDAO.includes(textNorm)) {
      await resetarFluxo(supabase, conversa.id)
      const nome = conversa.nome_contato || "irmão(ã)"
      try { await enviarMenu(uazapi, fromNumber, nome, "Estou à disposição! 😊 Posso ajudar com mais alguma coisa?") } catch { /* silencioso */ }
      await salvarMensagem(supabase, conversa.id, "[Menu interativo]")
      return NextResponse.json({ ok: true })
    }

    if (SAUDACOES.includes(textNorm) || step === "pastoral" || selecao === "menu") {
      await resetarFluxo(supabase, conversa.id)
      const nome = conversa.nome_contato || "irmão(ã)"
      try {
        await sendList(uazapi, fromNumber, {
          text: `A paz do Senhor, ${nome}! 😊\n\nComo posso ajudar?`,
          listButton: "Ver opções",
          choices: MENU_CHOICES,
          footer: "Nossa equipe pastoral está aqui por você ❤️",
        })
        await salvarMensagem(supabase, conversa.id, "[Menu interativo]")
      } catch (e) { console.error("[webhook] menu:", e) }
      return NextResponse.json({ ok: true })
    }

    // ── ACONSELHAMENTO — continuação via OpenAI ───────────────────────────────
    if (step === "casamento" && cfg.openai_api_key) {
      const { data: todasMsgs } = await (supabase as any)
        .from("mensagens_whatsapp").select("direcao, conteudo, created_at")
        .eq("conversa_id", conversa.id).order("created_at", { ascending: true }).limit(50)

      const allMsgs: any[] = todasMsgs ?? []
      const lastMenuIdx = [...allMsgs].reverse().findIndex(m => m.conteudo?.startsWith("[Menu") || m.conteudo?.startsWith("[Lista") || m.conteudo?.startsWith("[Início"))
      const inicioFluxo = lastMenuIdx >= 0 ? allMsgs.length - lastMenuIdx : 0
      const historico   = allMsgs.slice(inicioFluxo).filter(m => !m.conteudo?.startsWith("["))

      const systemPrompt = buildAconselhamentoPrompt(igrejaCfg.nome ?? "Igreja", cfg.sdr_nome || "Assistente Missionária")
      const respostaRaw  = await callOpenAI(cfg.openai_api_key, cfg.openai_model, systemPrompt, historico)
      if (!respostaRaw) return NextResponse.json({ ok: true })

      const handled = await processarAconselhamento(supabase, uazapi, cfg, conversa, respostaRaw, igrejaCfg.nome ?? "Igreja", igrejaCfg.id)
      if (handled) return NextResponse.json({ ok: true })

      const respostaFinal = respostaRaw.replace(/DADOS_\w+:[\s\S]*$/, "").trim()
      if (!respostaFinal) return NextResponse.json({ ok: true })

      await sendText(uazapi, fromNumber, respostaFinal)
      await salvarMensagem(supabase, conversa.id, respostaFinal)
    }

    return NextResponse.json({ ok: true, conversa_id: conversa.id })
  } catch (e: any) {
    console.error("[webhook] ERRO:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
