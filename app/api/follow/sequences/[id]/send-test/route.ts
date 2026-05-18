import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createUazapiClient, sendRichStep, normalizePhone, StepTipoMensagem, StepMediaConfig } from '@/lib/sdr/uazapi'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'

function safeDecrypt(value: string | null | undefined): string {
  if (!value) return ''
  if (value.startsWith('plain:')) return value.slice(6)
  const parts = value.split(':')
  if (parts.length === 3 && parts[0].length === 32 && parts[1].length === 32) {
    try { return decrypt(value) } catch { return '' }
  }
  return value
}

/**
 * POST /api/follow/sequences/[id]/send-test
 * Body: { stepId: string, phone: string, dryRun?: boolean }
 * Envia uma mensagem de teste via uazapi para um step específico da sequência.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const { stepId, phone, dryRun = false } = body as {
    stepId?: string
    phone?: string
    dryRun?: boolean
  }

  if (!stepId) {
    return NextResponse.json({ error: 'stepId é obrigatório' }, { status: 400 })
  }
  if (!phone && !dryRun) {
    return NextResponse.json({ error: 'phone é obrigatório quando dryRun=false' }, { status: 400 })
  }

  try {
    const service = createServiceClient()

    // Buscar a sequência e verificar que pertence à empresa
    const { data: sequence, error: seqErr } = await service
      .from('follow_sequences')
      .select('id, nome, tipo, company_id')
      .eq('id', params.id)
      .eq('company_id', context.companyId)
      .single()

    if (seqErr || !sequence) {
      return NextResponse.json({ error: 'Sequência não encontrada' }, { status: 404 })
    }

    // Buscar o step
    const { data: step, error: stepErr } = await service
      .from('follow_steps')
      .select('*')
      .eq('id', stepId)
      .eq('sequence_id', params.id)
      .single()

    if (stepErr || !step) {
      return NextResponse.json({ error: 'Step não encontrado nesta sequência' }, { status: 404 })
    }

    // dry run — simular sem enviar
    if (dryRun) {
      return NextResponse.json({
        success: true,
        simulated: true,
        step: {
          id: step.id,
          dia_offset: step.dia_offset,
          horario: step.horario,
          tipo_mensagem: step.tipo_mensagem,
          mensagem: step.mensagem,
        },
      })
    }

    // Normalizar o telefone
    const normalizedPhone = normalizePhone(phone as string)

    // Buscar config uazapi da empresa
    const platformCfg = await getPlatformConfig()

    const { data: sdrCfg } = await service
      .from('sdr_configs')
      .select('uazapi_instance_url, uazapi_token')
      .eq('company_id', context.companyId)
      .maybeSingle()

    const uazapiUrl = sdrCfg?.uazapi_instance_url ?? platformCfg.uazapi_base_url
    const uazapiToken = safeDecrypt(sdrCfg?.uazapi_token)

    if (!uazapiToken) {
      return NextResponse.json(
        { error: 'Instância uazapi não configurada. Configure em Agente SDR.' },
        { status: 400 }
      )
    }

    const uazapi = createUazapiClient(uazapiUrl, uazapiToken)

    const tipo: StepTipoMensagem = step.tipo_mensagem ?? 'text'
    const mensagem: string = step.mensagem || `[Teste] Passo D${step.dia_offset} — ${sequence.nome}`
    const media: StepMediaConfig | undefined = step.media_config ?? undefined

    await sendRichStep(uazapi, normalizedPhone, tipo, mensagem, media)

    return NextResponse.json({
      success: true,
      simulated: false,
      phone: normalizedPhone,
      step: {
        id: step.id,
        dia_offset: step.dia_offset,
        horario: step.horario,
        tipo_mensagem: tipo,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
