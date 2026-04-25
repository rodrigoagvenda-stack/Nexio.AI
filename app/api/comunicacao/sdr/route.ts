import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface MensagemHist {
  role: "system" | "user" | "assistant"
  content: string
}

// ─── Prompts por tipo de fluxo ────────────────────────────────────────────────

function buildSystemPrompt(fluxo: string, cfg: any, contexto: any): string {
  const nome_assistente = cfg?.sdr_nome || "Assistente Missionária"
  const nome_igreja = contexto?.nome_igreja || "nossa Igreja"
  const nome_membro = contexto?.nome_membro || "irmão(ã)"
  const escala_info = contexto?.escala_info || ""

  if (fluxo === "escala") return `Você é ${nome_assistente} da ${nome_igreja}. Sua missão é confirmar a disponibilidade de ${nome_membro} para servir na escala de cultos. ${escala_info}
Seja gentil, respeitoso e objetivo. Pergunte se tem disponibilidade. Se não tiver, pergunte o motivo (registre para análise). Agradeça sempre. Não seja repetitivo. Responda em português brasileiro natural e afetuoso, como alguém da comunidade.
Ao final da conversa, gere um RESUMO interno começando com "RESUMO_SDR:" contendo: confirmou (sim/não), motivo da recusa se houver, tom geral da conversa.`

  if (fluxo === "pastoral") return `Você é ${nome_assistente} da ${nome_igreja}. Sua missão é se conectar pastoralmente com ${nome_membro}, perguntando como está sua vida, saúde, família e fé. Seja caloroso, empático e autêntico.
Ofereça opções de suporte: 🙏 Oração | 💰 Ajuda financeira | 💍 Aconselhamento conjugal | 👶 Apoio familiar | 📖 Estudo bíblico.
Registre qualquer necessidade mencionada. Se identificar situação urgente, inclua "ALERTA_PASTORAL:" no resumo com a categoria: financeiro | casamento | saude | espiritual.
Responda de forma humana, curta e acolhedora. Não seja clínico nem robótico.
Ao final, gere um RESUMO_SDR com o tipo de necessidade identificada e gravidade (baixa/media/alta).`

  if (fluxo === "visitante") return `Você é ${nome_assistente} da ${nome_igreja}. ${nome_membro} visitou nossa igreja recentemente. Agradeça a presença com genuíno acolhimento.
Pergunte como foi a experiência. Peça uma nota de 1 a 5 para a recepção. Pergunte se pode convidar para próximos cultos. Ofereça seguir nossas redes sociais.
Seja leve, simpático e sem pressão. Se a pessoa aceitar contato futuro, confirme e agradeça. Se recusar, agradeça com elegância.
Ao final, gere RESUMO_SDR: nota_recebida, deseja_retorno (sim/não), observacoes.`

  return `Você é ${nome_assistente} da ${nome_igreja}. Seja gentil e prestativo com ${nome_membro}.`
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = await req.json()
  const { conversa_id, historico, fluxo, contexto } = body

  if (!conversa_id || !historico) return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })

  const { data: conversa } = await (supabase as any)
    .from("conversas_whatsapp").select("telefone, igreja_id, ia_ativa").eq("id", conversa_id).single()
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 })

  const { data: igreja } = await (supabase as any)
    .from("igrejas").select("configuracoes, nome").eq("id", conversa.igreja_id).single()
  const cfg = igreja?.configuracoes ?? {}

  if (!cfg.openai_api_key) return NextResponse.json({ error: "API key do OpenAI não configurada. Acesse Área Administrativa." }, { status: 400 })

  const systemPrompt = buildSystemPrompt(fluxo || "pastoral", cfg, { ...contexto, nome_igreja: igreja?.nome })

  const messages: MensagemHist[] = [
    { role: "system", content: systemPrompt },
    ...historico.map((m: any) => ({
      role: m.direcao === "saida" ? "assistant" : "user",
      content: m.conteudo,
    })),
  ]

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.openai_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.openai_model || "gpt-4o-mini",
        messages,
        max_tokens: 600,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? "Erro na OpenAI" }, { status: 502 })
    }

    const json = await res.json()
    const resposta: string = json.choices?.[0]?.message?.content ?? ""

    // Extract summary if present
    let resumo: string | null = null
    let alerta: string | null = null
    // Extract summary/alert from response using simple string matching
    const resumoMatch = resposta.indexOf("RESUMO_SDR:")
    const alertaMatch = resposta.indexOf("ALERTA_PASTORAL:")
    if (resumoMatch !== -1) resumo = resposta.substring(resumoMatch + 11).split("\n")[0].trim()
    if (alertaMatch !== -1) alerta = resposta.substring(alertaMatch + 16).split("\n")[0].trim()

    const textoLimpo = resposta
      .replace("RESUMO_SDR:" + (resumo ?? ""), "")
      .replace("ALERTA_PASTORAL:" + (alerta ?? ""), "")
      .trim()

    // If summary detected, save to conversation
    if (resumo) {
      await (supabase as any).from("conversas_whatsapp").update({ resumo_ia: resumo }).eq("id", conversa_id)
    }

    // If alert detected, notify pastors
    if (alerta) {
      const numeros: any[] = cfg.numeros_notificacao ?? []
      const alertaStr: string = alerta
      const categoriaAlerta = alertaStr.toLowerCase().includes("financeiro") ? "financeiro"
        : alertaStr.toLowerCase().includes("casamento") ? "casamento"
        : alertaStr.toLowerCase().includes("saude") ? "saude"
        : "pastoral"

      const destinatarios = numeros.filter(n => n.categoria === "geral" || n.categoria === categoriaAlerta)
      const alertasMsgBase = `🚨 *ALERTA PASTORAL — ${igreja?.nome || "Igreja"}*\n\n*Categoria:* ${categoriaAlerta}\n*Membro:* ${contexto?.nome_membro || "—"}\n*Resumo:* ${resumo || alerta}`

      for (const dest of destinatarios) {
        if (cfg.uazapi_token && cfg.uazapi_instance) {
          try {
            const baseUrl = (cfg.uazapi_base_url || "https://api.uazapi.io").replace(/\/$/, "")
            await fetch(`${baseUrl}/message/sendText`, {
              method: "POST",
              headers: { "apikey": cfg.uazapi_token, "Authorization": `Bearer ${cfg.uazapi_token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ instance: cfg.uazapi_instance, number: dest.telefone, text: alertasMsgBase }),
              signal: AbortSignal.timeout(8000),
            })
          } catch { /* silently fail alert — don't block response */ }
        }
      }
    }

    // Save AI message to DB
    await (supabase as any).from("mensagens_whatsapp").insert({
      conversa_id,
      direcao: "saida",
      conteudo: textoLimpo,
      ia_gerada: true,
      status: "pendente",
    })

    return NextResponse.json({ resposta: textoLimpo, resumo, alerta })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
