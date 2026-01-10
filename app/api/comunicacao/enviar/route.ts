import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Mensagem } from "@/types/database.types"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tipo, destinatarios, segmentacao, assunto, mensagem } = await request.json()

    // Criar registro de mensagem
    const { data: mensagemData, error: mensagemError } = await supabase
      .from("mensagens")
      .insert({
        tipo,
        destinatarios,
        segmentacao,
        assunto,
        mensagem,
        status: "enviando",
        enviado_por: user.id,
      })
      .select()
      .single<Mensagem>()

    if (mensagemError) throw mensagemError

    // Buscar destinatários baseado na segmentação
    let destinatariosFinal: any[] = []

    if (tipo === "individual" && destinatarios) {
      destinatariosFinal = destinatarios
    } else if (tipo === "massa" && segmentacao) {
      let query = supabase
        .from("membros")
        .select("id, nome, telefone")
        .eq("status", "ativo")
        .not("telefone", "is", null)

      if (segmentacao.igreja_id) query = query.eq("igreja_id", segmentacao.igreja_id)
      if (segmentacao.cargo) query = query.eq("cargo", segmentacao.cargo)
      if (segmentacao.dizimista !== undefined) query = query.eq("dizimista", segmentacao.dizimista)

      const { data: membros } = await query

      destinatariosFinal = membros?.map(m => ({
        id: m.id,
        nome: m.nome,
        telefone: m.telefone,
      })) || []
    }

    // Chamar n8n para enviar via WhatsApp
    const n8nUrl = `${process.env.N8N_WEBHOOK_URL_BASE}/webhook/enviar-mensagem-massa`

    const response = await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.N8N_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({
        mensagem_id: mensagemData.id,
        mensagem,
        destinatarios: destinatariosFinal,
      }),
    })

    if (!response.ok) {
      throw new Error("Erro ao enviar mensagem via n8n")
    }

    // Atualizar status
    await supabase
      .from("mensagens")
      .update({
        status: "enviado",
        total_destinatarios: destinatariosFinal.length,
        data_envio: new Date().toISOString(),
      })
      .eq("id", mensagemData.id)

    return NextResponse.json({
      data: mensagemData,
      message: `Mensagem enviada para ${destinatariosFinal.length} destinatários`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
