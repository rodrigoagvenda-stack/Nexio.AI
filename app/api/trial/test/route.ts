/**
 * POST /api/trial/test
 * Dispara uma mensagem de teste direto para o número configurado em test_phone,
 * sem depender de sequências cadastradas.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizePhone, createUazapiClient } from '@/lib/sdr/uazapi'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()

  const { data: cfg } = await supabase
    .from('trial_configs')
    .select('test_mode, test_phone')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!cfg?.test_mode || !cfg?.test_phone) {
    return NextResponse.json({ error: 'Modo teste não está ativo ou número não configurado.' }, { status: 400 })
  }

  const phone = normalizePhone(cfg.test_phone)

  const platformCfg = await getPlatformConfig()
  const { data: sdrCfg } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', context.companyId)
    .maybeSingle()

  const uazapiUrl = sdrCfg?.uazapi_instance_url ?? platformCfg.uazapi_base_url
  const uazapiToken = sdrCfg?.uazapi_token ? decrypt(sdrCfg.uazapi_token) : ''

  if (!uazapiToken) {
    return NextResponse.json({ error: 'Instância uazapi não configurada.' }, { status: 400 })
  }

  const uazapi = createUazapiClient(uazapiUrl, uazapiToken)

  const res = await uazapi.post('/send/text', {
    number: phone,
    type: 'text',
    text: `🧪 *Teste de Trial SaaS*\n\nOlá, Lead Teste! Esse é um disparo de teste do sistema de trial. Se chegou aqui, tudo está funcionando corretamente. ✅`,
    delay: 1000,
  })

  if (res.status >= 400) {
    return NextResponse.json({ error: 'Falha ao enviar mensagem via uazapi.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, phone })
}
