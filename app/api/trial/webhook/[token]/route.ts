/**
 * POST /api/trial/webhook/[token]
 * Endpoint público para cadastros de trial SaaS.
 * Cada empresa configura seu próprio token em trial_configs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/sdr/uazapi'
import { runTrialSaasImmediate } from '@/lib/sdr/follow'
import { syslog } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const rl = rateLimit({ key: `trial-webhook:${ip}`, limit: 10, windowMs: 60_000 })
  if (!rl.success) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 })

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
  if (testMode) console.log(`[trial:webhook] MODO TESTE : redirecionando para ${whatsapp}`)
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
      },
      { onConflict: 'company_id,email', ignoreDuplicates: false }
    )
    .select('id')
    .maybeSingle()

  if (error || !trial?.id) {
    await syslog({
      type: 'trial_webhook',
      severity: 'error',
      message: `Erro ao salvar trial: ${error?.message ?? 'id não retornado'}`,
      company_id: cfg.company_id,
      payload: { email: body.email },
    })
    return NextResponse.json({ success: false, message: 'Erro ao processar cadastro.' }, { status: 500 })
  }

  // Dispara primeiro step em background : não bloqueia a resposta HTTP
  console.log(`[trial:webhook] disparando imediato trial=${trial.id} company=${cfg.company_id}`)
  runTrialSaasImmediate(cfg.company_id, trial.id)
    .then(r => console.log(`[trial:webhook] imediato sent=${r.sent} error=${r.error ?? 'ok'}`))
    .catch(err => console.error(`[trial:webhook] imediato falhou: ${err.message}`))

  return NextResponse.json({ success: true, message: 'Cadastro realizado com sucesso!' })
}
