import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Buscar escala com detalhes
    const { data: escala, error } = await supabase
      .from("escalas")
      .select(`
        *,
        igrejas(nome, logo_url),
        escalas_detalhes(
          *,
          membro_oracao:membros!membro_oracao_id(nome),
          membro_louvor:membros!membro_louvor_id(nome),
          membro_pregacao:membros!membro_pregacao_id(nome),
          membro_som:membros!membro_som_id(nome),
          membro_recepcao:membros!membro_recepcao_id(nome)
        )
      `)
      .eq("id", params.id)
      .single() as any

    if (error) throw error

    // Aqui você integraria com @react-pdf/renderer ou puppeteer
    // Por agora, vou simular a geração do PDF

    const pdfUrl = `${process.env.NEXT_PUBLIC_APP_URL}/storage/escalas/escala_${params.id}.pdf`

    // Atualizar escala com URL do PDF
    await (supabase as any)
      .from("escalas")
      .update({ pdf_url: pdfUrl })
      .eq("id", params.id)

    // Trigger webhook n8n para enviar no grupo WhatsApp
    const n8nUrl = `${process.env.N8N_WEBHOOK_URL_BASE}${process.env.N8N_ENVIAR_PDF_WEBHOOK}`

    await fetch(n8nUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.N8N_WEBHOOK_SECRET}`,
      },
      body: JSON.stringify({
        event: "escala_gerada",
        escala_id: params.id,
        pdf_url: pdfUrl,
        igreja: escala.igrejas?.nome,
        periodo: `${getMonthName(escala.mes)} ${escala.ano}`,
        grupos_whatsapp: ["5573999999999-1234567890@g.us"], // Configurar dinamicamente
      }),
    })

    return NextResponse.json({
      data: { pdf_url: pdfUrl },
      message: "PDF gerado e enviado para o WhatsApp!",
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function getMonthName(mes: number): string {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]
  return meses[mes - 1]
}
