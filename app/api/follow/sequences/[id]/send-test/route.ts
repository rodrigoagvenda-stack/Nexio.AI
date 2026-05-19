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

    // Map canvas PT tipo to uazapi EN tipo (in case step was saved before the mapping fix)
    const TIPO_MAP: Record<string, StepTipoMensagem> = {
      texto: 'text', imagem: 'image', video: 'video', audio: 'audio',
      ptt: 'ptt', documento: 'document', localizacao: 'location',
      lista: 'menu', botoes: 'menu', carrossel: 'carousel',
    }
    const rawTipo = step.tipo_mensagem ?? 'text'
    const tipo: StepTipoMensagem = (TIPO_MAP[rawTipo] ?? rawTipo) as StepTipoMensagem

    const media: StepMediaConfig | undefined = step.media_config ?? undefined
    // For media types, caption is in media_config.text; for text, use mensagem directly
    const mensagem: string = step.mensagem
      || media?.text
      || `[Teste] Passo D${step.dia_offset} — ${sequence.nome}`

    await sendRichStep(uazapi, normalizedPhone, tipo, mensagem, media)

    // Save message to atendimento chat if a conversa exists for this phone
    try {
      const variants = [normalizedPhone, `+${normalizedPhone}`, normalizedPhone.replace(/^55/, '')]
      const { data: conversa } = await service
        .from('conversas_do_whatsapp')
        .select('id, id_do_lead')
        .eq('company_id', sequence.company_id)
        .in('numero_de_telefone', variants)
        .maybeSingle()

      if (conversa) {
        const mediaUrl = media?.file ?? null
        const textoSalvo = mensagem
        await Promise.all([
          service.from('mensagens_do_whatsapp').insert({
            id_da_conversacao: conversa.id,
            id_do_lead: conversa.id_do_lead,
            company_id: sequence.company_id,
            texto_da_mensagem: textoSalvo,
            tipo_de_mensagem: tipo,
            direcao: 'outbound',
            sender_type: 'ai',
            status: 'sent',
            url_da_midia: mediaUrl,
            carimbo_de_data_e_hora: new Date().toISOString(),
          }),
          service.from('conversas_do_whatsapp').update({
            ultima_mensagem: mediaUrl ? `[${tipo}]` : textoSalvo,
            hora_da_ultima_mensagem: new Date().toISOString(),
          }).eq('id', conversa.id),
        ])
      }
    } catch {
      // Non-fatal: message was sent, just couldn't save to atendimento
    }

    return NextResponse.json({
      success: true,
      simulated: false,
      phone: normalizedPhone,
      step: { id: step.id, dia_offset: step.dia_offset, horario: step.horario, tipo_mensagem: tipo },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
