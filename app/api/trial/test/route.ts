/**
 * POST /api/trial/test
 * Dispara imediatamente os steps do dia informado para o número de teste.
 * Não cria trial nem grava execuções — é um disparo direto para validação.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizePhone, createUazapiClient, sendRichStep, StepMediaConfig, StepTipoMensagem } from '@/lib/sdr/uazapi'
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

function substituirVariaveis(texto: string): string {
  return texto
    .replace(/\{nome\}/g, 'Lead Teste')
    .replace(/\{primeiro_nome\}/g, 'Teste')
    .replace(/\{status\}/g, 'trial_ativo')
    .replace(/\{data_call\}/g, '')
}

function phoneVariants(phone: string): string[] {
  const variants: string[] = [phone]
  const push = (v: string) => { if (!variants.includes(v)) variants.push(v) }
  if (phone.startsWith('55')) {
    if (phone.length === 13) { push(phone.slice(0, 4) + phone.slice(5)); push('+' + phone) }
    else if (phone.length === 12) { push(phone.slice(0, 4) + '9' + phone.slice(4)); push('+' + phone) }
    else push('+' + phone)
  }
  return variants
}

async function aplicarSdrAtivo(
  supabase: any, companyId: number, phone: string, sdrAtivo: boolean
): Promise<void> {
  const phoneVars = phoneVariants(phone)
  console.log(`[trial:test] aplicarSdrAtivo — phone=${phone} sdr_ativo=${sdrAtivo}`)

  const { data: conv } = await supabase
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', companyId)
    .in('numero_de_telefone', phoneVars)
    .order('hora_da_ultima_mensagem', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conv?.id) {
    console.warn(`[trial:test] aplicarSdrAtivo — conversa não encontrada para phone=${phone}`)
    return
  }

  const { error: updateErr } = await supabase
    .from('conversas_do_whatsapp')
    .update({ agente_pausado: !sdrAtivo })
    .eq('id', conv.id)

  if (updateErr) console.error(`[trial:test] erro ao atualizar agente_pausado:`, updateErr.message)
  else console.log(`[trial:test] agente_pausado=${!sdrAtivo} aplicado — conv=${conv.id}`)

  if (sdrAtivo === true) {
    const contexto = `[Trial SaaS - Teste] SDR reativado via teste. Estágio: não definido. Contexto de teste.`
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('company_id', companyId)
      .in('whatsapp', phoneVars)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lead?.id) {
      await supabase.from('leads')
        .update({ notes: contexto, updated_at: new Date().toISOString() })
        .eq('id', lead.id)
      console.log(`[trial:test] contexto SDR injetado — lead=${lead.id}`)
    }
  }
}

async function gravarMensagemTeste(
  supabase: any, companyId: number, phone: string,
  text: string, tipoMensagem: StepTipoMensagem, media?: StepMediaConfig
): Promise<void> {
  const phoneVars = phoneVariants(phone)
  console.log(`[trial:test] gravarMensagem — phone=${phone} tipo=${tipoMensagem} variants=${JSON.stringify(phoneVars)}`)

  const { data: byPhone, error: searchErr } = await supabase
    .from('conversas_do_whatsapp').select('id')
    .eq('company_id', companyId).in('numero_de_telefone', phoneVars)
    .order('hora_da_ultima_mensagem', { ascending: false }).limit(1)

  if (searchErr) console.error(`[trial:test] erro ao buscar conversa:`, searchErr.message)
  console.log(`[trial:test] busca conversa — resultado:`, byPhone)

  let convId: number | null = byPhone?.[0]?.id ?? null

  if (!convId) {
    console.log(`[trial:test] conversa não encontrada — criando nova para phone=${phone}`)
    const { data: newConv, error: convErr } = await supabase
      .from('conversas_do_whatsapp').insert({
        company_id: companyId, numero_de_telefone: phone,
        nome_do_contato: 'Lead Teste', ultima_mensagem: text || `[${tipoMensagem}]`,
        hora_da_ultima_mensagem: new Date().toISOString(),
        status_da_conversa: 'aberto', contagem_nao_lida: 0,
      }).select('id').single()
    if (convErr) console.error(`[trial:test] erro ao criar conversa:`, convErr.message)
    convId = newConv?.id ?? null
    console.log(`[trial:test] conversa criada — id=${convId}`)
  } else {
    console.log(`[trial:test] conversa encontrada — id=${convId}`)
  }

  if (!convId) { console.error(`[trial:test] convId null — mensagem não salva`); return }

  let urlMidia: string | null = null
  if (tipoMensagem === 'menu' && media?.choices?.length)
    urlMidia = JSON.stringify({ menuType: media.menuType ?? 'button', choices: media.choices, button_actions: media.button_actions ?? {} })
  else if (tipoMensagem === 'carousel' && media?.carousel?.length)
    urlMidia = JSON.stringify(media.carousel)
  else if (['image', 'video', 'audio', 'ptt', 'document'].includes(tipoMensagem) && media?.file)
    urlMidia = media.file

  const displayText = text || media?.text || `[${tipoMensagem}]`

  const { error: msgErr } = await supabase.from('mensagens_do_whatsapp').insert({
    id_da_conversacao: convId, company_id: companyId,
    texto_da_mensagem: displayText, tipo_de_mensagem: tipoMensagem,
    url_da_midia: urlMidia, direcao: 'outbound', sender_type: 'ai',
    status: 'sent', nome_do_agente: 'Trial SaaS',
    carimbo_de_data_e_hora: new Date().toISOString(),
  })
  if (msgErr) console.error(`[trial:test] erro ao inserir mensagem:`, msgErr.message)
  else console.log(`[trial:test] mensagem salva — conv=${convId} tipo=${tipoMensagem}`)

  await supabase.from('conversas_do_whatsapp')
    .update({ ultima_mensagem: displayText, hora_da_ultima_mensagem: new Date().toISOString() })
    .eq('id', convId)
}

function pickMessage(step: any): string {
  const pool = step.pool_mensagens
  if (Array.isArray(pool) && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)]
  }
  return step.mensagem || ''
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
  const uazapiToken = safeDecrypt(sdrCfg?.uazapi_token)

  if (!uazapiToken) {
    return NextResponse.json({ error: 'Instância uazapi não configurada em Agente SDR.' }, { status: 400 })
  }

  const uazapi = createUazapiClient(uazapiUrl, uazapiToken)

  // Dispara cada step do dia diretamente
  let sent = 0
  const errors: string[] = []

  for (const step of steps) {
    const tipo: StepTipoMensagem = step.tipo_mensagem ?? 'text'
    const textoRaw = pickMessage(step) || `Oi Lead Teste! Acompanhamento D${day} do trial. 😊`
    const texto = substituirVariaveis(textoRaw)
    const media: StepMediaConfig | undefined = step.media_config ?? undefined

    try {
      await sendRichStep(uazapi, phone, tipo, texto, media)

      // Salva na conversa do atendimento
      await gravarMensagemTeste(supabase, context.companyId, phone, texto, tipo, media)

      // Aplica controle de SDR se configurado
      const sdrAtivo: boolean | null = step.sdr_ativo ?? null
      console.log(`[trial:test] step ${step.ordem} sdr_ativo=${JSON.stringify(sdrAtivo)}`)
      if (sdrAtivo !== null) {
        await aplicarSdrAtivo(supabase, context.companyId, phone, sdrAtivo)
      }

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
