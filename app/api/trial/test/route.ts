/**
 * POST /api/trial/test
 * Simula um dia específico do trial para o número de teste.
 * - Cria/atualiza o trial de teste com created_at = agora - N dias
 * - Dispara imediatamente todos os steps com dia_offset = N da sequência ativa
 * - Limpa execuções anteriores desse dia para permitir re-teste
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizePhone, createUazapiClient, sendRichStep } from '@/lib/sdr/uazapi'
import { getPlatformConfig } from '@/lib/platform-config'
import { decrypt } from '@/lib/crypto'

function substituirVariaveis(texto: string, nome: string): string {
  return texto
    .replace(/\{nome\}/g, nome)
    .replace(/\{primeiro_nome\}/g, nome.split(' ')[0])
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
    .select('test_mode, test_phone, trial_days_default')
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (!cfg?.test_mode || !cfg?.test_phone) {
    return NextResponse.json({ error: 'Modo teste não está ativo ou número não configurado.' }, { status: 400 })
  }

  const phone = normalizePhone(cfg.test_phone)
  const trialDays = cfg.trial_days_default ?? 7

  // Calcula created_at simulado: agora - N dias
  const simulatedCreatedAt = new Date(Date.now() - day * 86_400_000).toISOString()

  // Upsert trial de teste (sem criado_em — atualiza separado)
  const { data: trial, error: trialErr } = await supabase
    .from('saas_trials')
    .upsert(
      {
        company_id: context.companyId,
        nome: 'Lead Teste',
        email: 'teste-simulacao@trial.com',
        whatsapp: phone,
        trial_days: trialDays,
        status: 'ativo',
        estagio: `teste_gratis_${trialDays}_dias`,
      },
      { onConflict: 'company_id,email', ignoreDuplicates: false }
    )
    .select('id')
    .maybeSingle()

  if (trialErr || !trial) {
    return NextResponse.json({ error: `saas_trials upsert: ${trialErr?.message ?? 'sem retorno'}` }, { status: 500 })
  }

  // Avança a data simulada para o dia correto
  const { error: dateErr } = await supabase
    .from('saas_trials')
    .update({ criado_em: simulatedCreatedAt })
    .eq('id', trial.id)

  if (dateErr) {
    return NextResponse.json({ error: `update criado_em: ${dateErr.message}` }, { status: 500 })
  }

  // Busca sequências trial_saas ativas
  const { data: sequences } = await supabase
    .from('follow_sequences')
    .select('id, nome')
    .eq('company_id', context.companyId)
    .eq('tipo', 'trial_saas')
    .eq('ativo', true)

  if (!sequences?.length) {
    return NextResponse.json({ error: 'Nenhuma sequência trial_saas ativa encontrada. Crie uma em Sequências.' }, { status: 400 })
  }

  // Busca steps com dia_offset = day
  const sequenceIds = sequences.map((s) => s.id)
  const { data: steps } = await supabase
    .from('follow_steps')
    .select('*')
    .in('sequence_id', sequenceIds)
    .eq('dia_offset', day)
    .order('ordem', { ascending: true })

  if (!steps?.length) {
    return NextResponse.json({ error: `Nenhum passo configurado para o dia ${day}. Adicione um step D${day} na sequência.` }, { status: 400 })
  }

  // Remove execuções anteriores desse dia para permitir re-teste
  const stepIds = steps.map((s) => s.id)
  await supabase
    .from('follow_executions')
    .delete()
    .eq('trial_id', trial.id as any)
    .in('step_id', stepIds)

  // Configura uazapi
  const platformCfg = await getPlatformConfig()
  const { data: sdrCfg } = await supabase
    .from('sdr_configs')
    .select('uazapi_instance_url, uazapi_token')
    .eq('company_id', context.companyId)
    .maybeSingle()

  const uazapiUrl = sdrCfg?.uazapi_instance_url ?? platformCfg.uazapi_base_url
  const uazapiToken = sdrCfg?.uazapi_token ? decrypt(sdrCfg.uazapi_token) : ''

  if (!uazapiToken) {
    return NextResponse.json({ error: 'Instância uazapi não configurada em Agente SDR.' }, { status: 400 })
  }

  const uazapi = createUazapiClient(uazapiUrl, uazapiToken)

  // Dispara cada step do dia
  let sent = 0
  const errors: string[] = []

  for (const step of steps) {
    const tipo = step.tipo_mensagem ?? 'text'
    const textoRaw = step.mensagem || `Oi {nome}! Acompanhamento do dia ${day} do seu trial. 😊`
    const texto = substituirVariaveis(textoRaw, 'Lead Teste')
    const media = step.media_config ?? undefined

    try {
      await sendRichStep(uazapi, phone, tipo, texto, media)
      await supabase.from('follow_executions').insert({
        trial_id: trial.id as any,
        sequence_id: step.sequence_id,
        step_id: step.id,
        company_id: context.companyId,
        status: 'sent',
      })
      sent++
    } catch (err: any) {
      errors.push(err.message)
      await supabase.from('follow_executions').insert({
        trial_id: trial.id as any,
        sequence_id: step.sequence_id,
        step_id: step.id,
        company_id: context.companyId,
        status: 'failed',
      })
    }
  }

  return NextResponse.json({
    success: sent > 0,
    sent,
    day,
    phone,
    errors: errors.length ? errors : undefined,
  })
}
