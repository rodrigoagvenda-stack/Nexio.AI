/**
 * POST /api/trial/test
 * Dispara imediatamente os steps do dia informado para o número de teste.
 * Não cria trial nem grava execuções — é um disparo direto para validação.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizePhone, createUazapiClient, sendRichStep } from '@/lib/sdr/uazapi'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'

function substituirVariaveis(texto: string): string {
  return texto
    .replace(/\{nome\}/g, 'Lead Teste')
    .replace(/\{primeiro_nome\}/g, 'Teste')
    .replace(/\{status\}/g, 'trial_ativo')
    .replace(/\{data_call\}/g, '')
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const body = await req.json().catch(() => ({}))
  const day: number = typeof body.day === 'number' ? body.day : 0

  // Valida config de teste
  const { data: cfg } = await supabase
    .from('trial_configs')
    .select('test_mode, test_phone')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!cfg?.test_mode || !cfg?.test_phone) {
    return NextResponse.json({ error: 'Modo teste não está ativo ou número não configurado.' }, { status: 400 })
  }

  const phone = normalizePhone(cfg.test_phone)

  // Busca sequências trial_saas ativas
  const { data: sequences, error: seqErr } = await supabase
    .from('follow_sequences')
    .select('id, nome')
    .eq('company_id', context.companyId)
    .eq('tipo', 'trial_saas')
    .eq('ativo', true)

  if (seqErr) return NextResponse.json({ error: `sequences: ${seqErr.message}` }, { status: 500 })
  if (!sequences?.length) {
    return NextResponse.json({ error: 'Nenhuma sequência trial_saas ativa. Crie uma em Sequências.' }, { status: 400 })
  }

  // Busca steps com dia_offset = day
  const sequenceIds = sequences.map((s) => s.id)
  const { data: steps, error: stepsErr } = await supabase
    .from('follow_steps')
    .select('*')
    .in('sequence_id', sequenceIds)
    .eq('dia_offset', day)
    .order('ordem', { ascending: true })

  if (stepsErr) return NextResponse.json({ error: `steps: ${stepsErr.message}` }, { status: 500 })
  if (!steps?.length) {
    return NextResponse.json({ error: `Nenhum passo para o D${day}. Adicione um step D${day} na sequência.` }, { status: 400 })
  }

  // Configura uazapi
  const platformCfg = await getPlatformConfig()
  const { data: sdrCfg, error: sdrErr } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (sdrErr) return NextResponse.json({ error: `sdr_configs: ${sdrErr.message}` }, { status: 500 })

  const uazapiUrl = sdrCfg?.uazapi_instance_url ?? platformCfg.uazapi_base_url
  const uazapiToken = sdrCfg?.uazapi_token ? decrypt(sdrCfg.uazapi_token) : ''

  if (!uazapiToken) {
    return NextResponse.json({ error: 'Instância uazapi não configurada em Agente SDR.' }, { status: 400 })
  }

  const uazapi = createUazapiClient(uazapiUrl, uazapiToken)

  // Dispara cada step do dia diretamente
  let sent = 0
  const errors: string[] = []

  for (const step of steps) {
    const tipo = step.tipo_mensagem ?? 'text'
    const textoRaw = step.mensagem || `Oi Lead Teste! Acompanhamento D${day} do trial. 😊`
    const texto = substituirVariaveis(textoRaw)
    const media = step.media_config ?? undefined

    try {
      await sendRichStep(uazapi, phone, tipo, texto, media)
      sent++
    } catch (err: any) {
      errors.push(`Step ${step.ordem}: ${err.message}`)
    }
  }

  if (sent === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent, day, phone, errors: errors.length ? errors : undefined })
}
