import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createUazapiClient, sendRichStep, normalizePhone, StepTipoMensagem, StepMediaConfig } from '@/lib/sdr/uazapi'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'
import { getRedis } from '@/lib/sdr/redis'

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
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

    // dry run : simular sem enviar
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

    console.log(`[send-test] company=${context.companyId} uazapiUrl=${uazapiUrl} tokenLen=${uazapiToken.length} sdrCfg=${!!sdrCfg}`)

    if (!uazapiToken) {
      // log extra antes do early return
      console.log(`[send-test] token vazio : abortando`)
      return NextResponse.json(
        { error: 'Instância uazapi não configurada. Configure em Agente SDR.' },
        { status: 400 }
      )
    }

    const uazapi = createUazapiClient(uazapiUrl, uazapiToken)

    // Verifica e configura o webhook se necessário
    try {
      const wh = await uazapi.getWebhook()
      const currentUrl = wh?.url ?? wh?.webhook?.url ?? ''
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
      const nexioSecret = process.env.NEXIO_WEBHOOK_SECRET ?? ''
      const expectedUrl = nexioSecret
        ? `${appUrl}/api/webhook/nexio?secret=${encodeURIComponent(nexioSecret)}`
        : `${appUrl}/api/webhook/nexio`
      console.log(`[send-test] webhook atual="${currentUrl}" esperado="${expectedUrl}"`)
      if (!currentUrl || !currentUrl.includes('/api/webhook/nexio')) {
        await uazapi.setWebhook(expectedUrl)
        console.log(`[send-test] webhook reconfigurado → ${expectedUrl}`)
      }
    } catch (whErr) {
      console.log(`[send-test] erro ao verificar/configurar webhook: ${whErr instanceof Error ? whErr.message : whErr}`)
    }

    // Map canvas PT tipo to uazapi EN tipo (in case step was saved before the mapping fix)
    const TIPO_MAP: Record<string, StepTipoMensagem> = {
      texto: 'text', imagem: 'image', video: 'video', audio: 'audio',
      ptt: 'ptt', documento: 'document', localizacao: 'location',
      lista: 'menu', botoes: 'menu', carrossel: 'carousel', sticker: 'sticker',
      // scheduling node: send mensagemInicial as plain text
      agendamento: 'text',
    }
    const rawTipo = step.tipo_mensagem ?? 'text'
    const tipo: StepTipoMensagem = (TIPO_MAP[rawTipo] ?? rawTipo) as StepTipoMensagem

    const media: StepMediaConfig | undefined = step.media_config ?? undefined
    const menuFallback = tipo === 'menu' ? 'Selecione uma opção:' : null
    const agendamentoFallback = rawTipo === 'agendamento' ? ((step.media_config as any)?.mensagemInicial || null) : null
    const mensagemRaw: string = step.mensagem || agendamentoFallback || media?.text || menuFallback || `[Passo D${step.dia_offset}]`

    // Substituir variáveis {nome}, {primeiro_nome} etc usando dados reais do lead
    const variants = [normalizedPhone, `+${normalizedPhone}`, normalizedPhone.replace(/^55/, '')]
    const { data: conversaLead } = await service
      .from('conversas_do_whatsapp')
      .select('id_do_lead')
      .eq('company_id', context.companyId)
      .in('numero_de_telefone', variants)
      .maybeSingle()
    let leadName = ''
    if (conversaLead?.id_do_lead) {
      const { data: leadRow } = await service.from('leads').select('contact_name').eq('id', conversaLead.id_do_lead).single()
      leadName = leadRow?.contact_name ?? ''
    }
    const primeiroNome = leadName.split(' ')[0]
    const substituir = (t: string) => t
      .replace(/\{nome\}/gi, leadName || 'você')
      .replace(/\{name\}/gi, leadName || 'você')
      .replace(/\{primeiro_nome\}/gi, primeiroNome || 'você')
      .replace(/\{first_name\}/gi, primeiroNome || 'você')

    const mensagem = substituir(mensagemRaw)

    // Typing delay before first message : ~30ms per char, capped at 4s
    const typingMs = (text: string) => Math.min(600 + text.length * 28, 4000) + Math.floor(Math.random() * 600)
    const humanSend = async (phone: string, t: typeof tipo, text: string, m?: typeof media) => {
      const ms = typingMs(text)
      try { await uazapi.sendPresence(phone, t === 'audio' || t === 'ptt' ? 'recording' : 'composing', ms) } catch {}
      await new Promise((r) => setTimeout(r, ms))
      await sendRichStep(uazapi, phone, t, text, m)
    }

    await humanSend(normalizedPhone, tipo, mensagem, media)

    // Blocos adicionais com delay humanizado
    const blocos: string[] = Array.isArray(step.media_config?.blocos) ? step.media_config.blocos : []
    for (let i = 1; i < blocos.length; i++) {
      const bloco = substituir(blocos[i] || '')
      if (!bloco) continue
      await humanSend(normalizedPhone, 'text', bloco, undefined)
    }

    // Scheduling node: ativa o roteamento para o agente de agendamento nas próximas respostas do lead
    if (rawTipo === 'agendamento') {
      try {
        const schedKey = `canvas:sched:${context.companyId}:${normalizedPhone}`
        await getRedis().set(schedKey, '1', 'EX', 172800) // 48h TTL
        console.log(`[send-test] canvas:sched setado para ${normalizedPhone}`)
      } catch (redisErr) {
        console.log(`[send-test] redis erro ao setar canvas:sched: ${redisErr instanceof Error ? redisErr.message : redisErr}`)
      }
    }

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
        // Build url_da_midia exactly like the trial does so atendimento renders correctly
        let urlMidia: string | null = null
        if (tipo === 'menu') urlMidia = JSON.stringify({ menuType: media?.menuType ?? 'button', choices: media?.choices ?? [], button_actions: media?.button_actions ?? {} })
        else if (tipo === 'carousel') urlMidia = JSON.stringify(media?.carousel ?? [])
        else if (['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(tipo)) urlMidia = media?.file ?? null

        const now = new Date().toISOString()

        await Promise.all([
          service.from('mensagens_do_whatsapp').insert({
            id_da_conversacao: conversa.id,
            id_do_lead: conversa.id_do_lead,
            company_id: sequence.company_id,
            texto_da_mensagem: mensagem,
            tipo_de_mensagem: tipo,
            direcao: 'outbound',
            sender_type: 'ai',
            status: 'sent',
            url_da_midia: urlMidia,
            carimbo_de_data_e_hora: now,
          }),
          service.from('mensagens_do_whatsapp').insert({
            id_da_conversacao: conversa.id,
            id_do_lead: conversa.id_do_lead,
            company_id: sequence.company_id,
            texto_da_mensagem: `Teste · ${sequence.nome} · Dia ${step.dia_offset}`,
            tipo_de_mensagem: 'system',
            direcao: 'outbound',
            sender_type: 'ai',
            status: 'sent',
            url_da_midia: null,
            carimbo_de_data_e_hora: new Date(Date.now() + 1).toISOString(),
          }),
          service.from('conversas_do_whatsapp').update({
            ultima_mensagem: mensagem,
            hora_da_ultima_mensagem: now,
            // Replica lógica do botão de pause do atendimento: sdr_ativo=false → agente_pausado=true
            ...(step.sdr_ativo != null ? { agente_pausado: !step.sdr_ativo } : {}),
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
