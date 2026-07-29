import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

const TIPO_LABEL: Record<string, string> = {
  text: 'Mensagem',
  image: 'Imagem',
  audio: 'Áudio',
  video: 'Vídeo',
  document: 'Documento',
  wait: 'Aguardar',
  condition: 'Condição',
  end: 'Fim',
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const service = createServiceClient()

    const { data: seq } = await service
      .from('follow_sequences')
      .select('id')
      .eq('id', params.id)
      .eq('company_id', context.companyId)
      .single()

    if (!seq) return NextResponse.json({ error: 'Sequência não encontrada' }, { status: 404 })

    let data: any[] = []
    try {
      const { data: rows, error } = await service
        .from('follow_executions')
        .select(`id, disparado_em, status, lead_id, step_id,
          leads (id, contact_name, company_name, whatsapp, email),
          follow_steps (id, mensagem, tipo_mensagem, dia_offset, ordem, customLabel)`)
        .eq('sequence_id', params.id)
        .order('disparado_em', { ascending: false })
        .limit(100)
      if (!error) data = rows ?? []
      else {
        // Fallback: plain fetch sem join
        const { data: plain } = await service
          .from('follow_executions')
          .select('id, disparado_em, status, lead_id, step_id')
          .eq('sequence_id', params.id)
          .order('disparado_em', { ascending: false })
          .limit(100)
        data = plain ?? []
      }
    } catch { data = [] }

    const logs = data.map((row: any) => {
      const l = row.leads
      const s = row.follow_steps

      const leadName =
        l?.contact_name ||
        l?.company_name ||
        l?.email ||
        l?.whatsapp ||
        (row.lead_id ? `Lead ${row.lead_id}` : ':')

      const tipoLabel = s ? (TIPO_LABEL[s.tipo_mensagem] ?? s.tipo_mensagem ?? 'Passo') : 'Passo'
      const ordem = s?.ordem != null ? `#${s.ordem}` : ''
      const dia = s?.dia_offset != null ? ` · Dia ${s.dia_offset}` : ''
      const preview = s?.mensagem ? ` : "${String(s.mensagem).slice(0, 30)}${String(s.mensagem).length > 30 ? '…' : ''}"` : ''

      const stepLabel = s
        ? `${tipoLabel} ${ordem}${dia}${preview}`
        : row.step_id
          ? `Passo ${String(row.step_id).slice(0, 8)}…`
          : ':'

      return {
        id: String(row.id),
        lead: leadName,
        telefone: l?.whatsapp ?? null,
        step: stepLabel,
        status: (row.status ?? 'sent') as 'sent' | 'failed' | 'skipped',
        ts: row.disparado_em ?? null,
      }
    })

    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
