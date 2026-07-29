import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createUazapiClient } from '@/lib/sdr/uazapi'
import { decrypt } from '@/lib/crypto'

function parseBrt(ts: string): Date {
  if (!ts) return new Date()
  if (/[Zz]$/.test(ts) || /[+-]\d{2}:?\d{2}$/.test(ts)) return new Date(ts.replace(' ', 'T'))
  return new Date(ts.replace(' ', 'T') + '-03:00')
}

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const log: string[] = []
  const now = Date.now()

  try {
    const brt = new Date(now - 3 * 3_600_000)
    const hour = brt.getUTCHours()
    const min = brt.getUTCMinutes()
    log.push(`⏰ Agora BRT: ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')} | nowMs=${now}`)

    // 1. sdr_configs
    const { data: cfg } = await supabase
      .from('sdr_configs')
      .select('company_id, uazapi_instance_url, uazapi_token, agente_ativo')
      .eq('company_id', context.companyId)
      .maybeSingle()

    if (!cfg) { log.push('❌ sdr_configs: NÃO ENCONTRADO'); return NextResponse.json({ ok: false, log }) }
    log.push(`sdr_configs: agente_ativo=${cfg.agente_ativo} | token=${cfg.uazapi_token ? '✅' : '❌ VAZIO'}`)
    if (!cfg.agente_ativo) log.push('⚠️ agente_ativo=false → cron pula esta empresa')
    if (!cfg.uazapi_token) log.push('❌ uazapi_token vazio → impossível enviar')

    // Health check WhatsApp (mesmo guard do cron)
    if (cfg.uazapi_token && cfg.uazapi_instance_url) {
      try {
        const token = (() => { try { return decrypt(cfg.uazapi_token) } catch { return cfg.uazapi_token } })()
        const uazapi = createUazapiClient(cfg.uazapi_instance_url, token)
        const { status } = await uazapi.getStatus()
        const healthy = status === 'connected'
        log.push(`📡 WhatsApp health: status="${status}" → ${healthy ? '✅ conectado' : '❌ DESCONECTADO : cron pula esta empresa!'}`)
        if (!healthy) log.push('   → Reconecte o WhatsApp em Configurações › WhatsApp para o anti-noshow funcionar')
      } catch (e: any) {
        log.push(`📡 WhatsApp health: ❌ erro ao checar (${e.message}) : cron vai tentar mesmo assim (fail-open)`)
      }
    }

    // 2. Sequências anti_noshow
    const { data: sequences } = await supabase
      .from('follow_sequences')
      .select('id, nome, ativo, canvas_config')
      .eq('company_id', context.companyId)
      .eq('tipo', 'anti_noshow')

    log.push(`\n📋 Sequências anti_noshow: ${sequences?.length ?? 0} encontradas`)
    if (!sequences?.length) {
      log.push('❌ Nenhuma sequência anti_noshow : engine não processa esta empresa')
      log.push('   → Crie uma sequência do tipo "anti_noshow" nas automações')
    }

    for (const seq of sequences ?? []) {
      log.push(`  • [${seq.ativo ? '✅ ATIVA' : '❌ inativa'}] "${seq.nome}" (id=${seq.id})`)
      const { data: steps } = await supabase
        .from('follow_steps')
        .select('id, dia_offset, horario, mensagem, tipo_mensagem, media_config, pool_mensagens')
        .eq('sequence_id', seq.id)
        .order('ordem')

      if (!steps?.length) { log.push('    ⚠️ SEM PASSOS'); continue }

      for (const s of steps) {
        const offsetUnit = (s.media_config as any)?.offset_unit
        const offsetMs = offsetUnit === 'minutes' ? s.dia_offset * 60_000 : s.dia_offset * 3_600_000
        const offsetLabel = offsetUnit === 'minutes' ? `${s.dia_offset}min` : `${s.dia_offset}h`
        const temMensagem = !!(s.mensagem?.trim()) || (Array.isArray(s.pool_mensagens) && s.pool_mensagens.some(Boolean))
        log.push(`    Passo offset=${offsetLabel} (${offsetUnit ?? 'hours'}) | mensagem=${temMensagem ? '✅' : '❌ VAZIA'}`)
      }
    }

    // 3. Leads elegíveis
    const { data: leads } = await supabase
      .from('leads')
      .select('id, contact_name, whatsapp, call_de_venda, call_agendada_para, call_status')
      .eq('company_id', context.companyId)
      .eq('call_de_venda', true)
      .eq('call_status', 'agendada')
      .not('call_agendada_para', 'is', null)

    log.push(`\n👤 Leads com call_de_venda=true + call_status=agendada: ${leads?.length ?? 0}`)

    if (!leads?.length) {
      log.push('❌ Nenhum lead elegível')
      log.push('   → Verifique se call_de_venda=true e call_status="agendada" estão salvos no lead')

      // Mostra leads com call agendada mas status diferente
      const { data: outros } = await supabase
        .from('leads')
        .select('id, contact_name, call_de_venda, call_agendada_para, call_status')
        .eq('company_id', context.companyId)
        .not('call_agendada_para', 'is', null)
        .limit(5)
      if (outros?.length) {
        log.push(`   Leads com call_agendada_para preenchido (status atual):`)
        for (const l of outros) log.push(`     #${l.id} ${l.contact_name} | call_de_venda=${l.call_de_venda} | call_status=${l.call_status}`)
      }
    }

    for (const lead of leads ?? []) {
      const callTime = parseBrt(lead.call_agendada_para!).getTime()
      const callBrt = new Date(callTime - 3 * 3_600_000)
      const callUTC = new Date(callTime)
      log.push(`  • #${lead.id} ${lead.contact_name} | raw_db="${lead.call_agendada_para}" | UTC=${callUTC.toISOString()} | BRT=${String(callBrt.getUTCHours()).padStart(2,'0')}:${String(callBrt.getUTCMinutes()).padStart(2,'0')} | whatsapp=${lead.whatsapp ?? '❌ VAZIO'}`)

      for (const seq of (sequences ?? []).filter((s: any) => s.ativo)) {
        const { data: steps } = await supabase
          .from('follow_steps')
          .select('id, dia_offset, media_config, mensagem, pool_mensagens')
          .eq('sequence_id', seq.id)
          .order('ordem')

        for (const s of steps ?? []) {
          const offsetUnit = (s.media_config as any)?.offset_unit
          const offsetMs = offsetUnit === 'minutes' ? s.dia_offset * 60_000 : s.dia_offset * 3_600_000
          const targetTime = callTime + offsetMs
          const diff = Math.abs(now - targetTime)
          const diffMin = (diff / 60_000).toFixed(1)
          const targetBrt = new Date(targetTime - 3 * 3_600_000)
          const jaMandou = await supabase
            .from('follow_executions')
            .select('id, status, executed_at')
            .eq('lead_id', lead.id)
            .eq('step_id', s.id)
            .maybeSingle()

          const offsetLabel = offsetUnit === 'minutes' ? `${s.dia_offset}min` : `${s.dia_offset}h`
          const dentroJanela = diff <= 20 * 60_000
          const execStatus = jaMandou.data ? `${jaMandou.data.status} em ${jaMandou.data.executed_at}` : 'nunca executado'

          log.push(`    [${seq.nome}] offset=${offsetLabel} → alvo BRT=${targetBrt.toUTCString()} | diff=${diffMin}min | janela=${dentroJanela ? '✅ dentro (±20min)' : `❌ fora (${diffMin}min > 20)`} | execução=${execStatus}`)
        }
      }
    }

    // 4. Execuções recentes
    const { data: execs } = await supabase
      .from('follow_executions')
      .select('lead_id, step_id, status, executed_at')
      .eq('company_id', context.companyId)
      .order('executed_at', { ascending: false })
      .limit(10)

    log.push(`\n📊 Últimas execuções anti_noshow: ${execs?.length ?? 0}`)
    for (const e of execs ?? []) {
      log.push(`  • lead #${e.lead_id} step=${e.step_id} status=${e.status} em ${e.executed_at}`)
    }

    return NextResponse.json({ ok: true, log, nowBRT: brt.toISOString() })
  } catch (err: any) {
    log.push(`❌ Erro: ${err.message}`)
    return NextResponse.json({ ok: false, log, error: err.message })
  }
}
