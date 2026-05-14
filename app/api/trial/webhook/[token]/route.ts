/**
 * POST /api/trial/webhook/[token]
 * Endpoint público para cadastros de trial SaaS.
 * Cada empresa configura seu próprio token em trial_configs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone, createUazapiClient, sendRichStep } from '@/lib/sdr/uazapi'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'
import { syslog } from '@/lib/logger'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient()

  // Resolve company by webhook token
  const { data: cfg } = await supabase
    .from('trial_configs')
    .select('company_id, trial_days_default, test_mode, test_phone')
    .eq('webhook_token', params.token)
    .maybeSingle()

  if (!cfg) {
    return NextResponse.json({ success: false, message: 'Token inválido.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.email || !body?.whatsapp) {
    return NextResponse.json({ success: false, message: 'Campos obrigatórios: name, email, whatsapp.' }, { status: 400 })
  }

  const testMode = cfg.test_mode === true && !!cfg.test_phone
  const whatsapp = testMode ? normalizePhone(cfg.test_phone!) : normalizePhone(body.whatsapp)
  if (testMode) console.log(`[trial:webhook] MODO TESTE — redirecionando para ${whatsapp}`)
  const trialDays = cfg.trial_days_default ?? 7

  // Upsert into saas_trials
  const { data: trial, error } = await supabase
    .from('saas_trials')
    .upsert(
      {
        company_id: cfg.company_id,
        nome: body.name,
        email: body.email,
        whatsapp,
        trial_days: trialDays,
        status: 'ativo',
        estagio: `teste_gratis_${trialDays}_dias`,
      },
      { onConflict: 'company_id,email', ignoreDuplicates: false }
    )
    .select('id')
    .maybeSingle()

  if (error) {
    await syslog({
      type: 'trial_webhook',
      severity: 'error',
      message: `Erro ao salvar trial: ${error.message}`,
      company_id: cfg.company_id,
      payload: { email: body.email },
    })
    return NextResponse.json({ success: false, message: 'Erro ao processar cadastro.' }, { status: 500 })
  }

  // Send welcome step (dia_offset = 0) immediately if configured
  try {
    const platformCfg = await getPlatformConfig()

    const { data: sdrCfg } = await supabase
      .from('sdr_configs')
      .select('uazapi_instance_url, uazapi_token')
      .eq('company_id', cfg.company_id)
      .maybeSingle()

    const uazapiUrl = sdrCfg?.uazapi_instance_url ?? platformCfg.uazapi_base_url
    const uazapiToken = sdrCfg?.uazapi_token ? decrypt(sdrCfg.uazapi_token) : ''

    if (uazapiToken && trial?.id) {
      // Find welcome step (dia_offset = 0) in any active trial_saas sequence for this company
      const { data: sequences } = await supabase
        .from('follow_sequences')
        .select('id')
        .eq('company_id', cfg.company_id)
        .eq('tipo', 'trial_saas')
        .eq('ativo', true)

      for (const seq of sequences ?? []) {
        const { data: welcomeStep } = await supabase
          .from('follow_steps')
          .select('*')
          .eq('sequence_id', seq.id)
          .eq('dia_offset', 0)
          .order('ordem', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (!welcomeStep) continue

        // Check not already sent
        const { data: alreadySent } = await supabase
          .from('follow_executions')
          .select('id')
          .eq('trial_id', trial.id)
          .eq('step_id', welcomeStep.id)
          .maybeSingle()

        if (alreadySent) break

        const uazapi = createUazapiClient(uazapiUrl, uazapiToken)
        const tipo = welcomeStep.tipo_mensagem ?? 'text'
        const texto = welcomeStep.mensagem ?? `Olá, ${body.name}! Seu período de teste foi ativado com sucesso. 🎉`

        await sendRichStep(uazapi, whatsapp, tipo, texto, welcomeStep.media_config ?? undefined)

        await supabase.from('follow_executions').insert({
          trial_id: trial.id,
          sequence_id: seq.id,
          step_id: welcomeStep.id,
          company_id: cfg.company_id,
          status: 'sent',
        })
        break
      }
    }
  } catch (err: any) {
    // Welcome message failure is non-fatal — trial was saved
    await syslog({
      type: 'trial_webhook',
      severity: 'warn',
      message: `Welcome step falhou: ${err.message}`,
      company_id: cfg.company_id,
      payload: { trial_id: trial?.id },
    })
  }

  return NextResponse.json({ success: true, message: 'Cadastro realizado com sucesso!' })
}
