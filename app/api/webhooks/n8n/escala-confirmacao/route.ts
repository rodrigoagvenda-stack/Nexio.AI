import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { Membro } from "@/types/database.types"

export async function POST(request: Request) {
  try {
    // Verificar autenticação do webhook
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.N8N_WEBHOOK_SECRET}`

    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const { membro_id, detalhe_escala_id, funcao, status, data_resposta } = await request.json()

    // Atualizar status de confirmação
    const updateField = `status_confirmacao_${funcao}`

    const { error } = await (supabase as any)
      .from("escalas_detalhes")
      .update({ [updateField]: status })
      .eq("id", detalhe_escala_id)

    if (error) throw error

    // Se recusou, reescalar automaticamente
    if (status === "recusado") {
      const { data: novoMembroId, error: reescalarError } = await (supabase as any).rpc("reescalar_membro", {
        p_detalhe_escala_id: detalhe_escala_id,
        p_funcao: funcao,
      })

      if (reescalarError) throw reescalarError

      // Buscar dados do novo membro para enviar confirmação
      const { data: novoMembro } = await supabase
        .from("membros")
        .select("id, nome, telefone")
        .eq("id", novoMembroId)
        .single() as any

      // Buscar dados do culto
      const { data: detalhe } = await supabase
        .from("escalas_detalhes")
        .select("data_culto, horario, tipo_culto")
        .eq("id", detalhe_escala_id)
        .single() as any

      // Chamar n8n novamente para enviar confirmação ao novo membro
      const n8nUrl = `${process.env.N8N_WEBHOOK_URL_BASE}${process.env.N8N_ESCALA_CONFIRMACAO_WEBHOOK}`

      await fetch(n8nUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.N8N_WEBHOOK_SECRET}`,
        },
        body: JSON.stringify({
          escala_id: detalhe_escala_id,
          escalados: [{
            membro_id: novoMembro?.id,
            nome: novoMembro?.nome,
            telefone: novoMembro?.telefone,
            funcao: funcao,
            data: detalhe?.data_culto,
            horario: detalhe?.horario,
          }],
        }),
      })

      return NextResponse.json({
        message: "Membro reescalado e notificação enviada",
        novo_membro_id: novoMembroId,
      })
    }

    return NextResponse.json({
      message: "Confirmação registrada com sucesso",
      status,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
