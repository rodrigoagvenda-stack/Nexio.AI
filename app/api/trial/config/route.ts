/**
 * GET  /api/trial/config  — retorna config da empresa (incluindo webhook URL)
 * POST /api/trial/config  — cria ou atualiza configuração de trial
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError
  const member = { company_id: context.companyId }
  const service = createServiceClient()

  const { data: config } = await service
    .from('trial_configs')
    .select('webhook_token, trial_days_options, trial_days_default')
    .eq('company_id', member.company_id)
    .maybeSingle()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm.nexioai.online'
  const webhookUrl = config?.webhook_token
    ? `${baseUrl}/api/trial/webhook/${config.webhook_token}`
    : null

  return NextResponse.json({ config, webhookUrl })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError
  const member = { company_id: context.companyId }
  const service = createServiceClient()

  const body = await req.json()
  const { trial_days_options, trial_days_default } = body

  const { data, error } = await service
    .from('trial_configs')
    .upsert(
      {
        company_id: member.company_id,
        trial_days_options: trial_days_options ?? [7, 15, 30],
        trial_days_default: trial_days_default ?? 7,
      },
      { onConflict: 'company_id' }
    )
    .select('webhook_token, trial_days_options, trial_days_default')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crm.nexioai.online'
  const webhookUrl = `${baseUrl}/api/trial/webhook/${data?.webhook_token}`

  return NextResponse.json({ config: data, webhookUrl })
}
