import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const log: string[] = []
  const now = Date.now()

  try {
    // 1. Business hours check
    const brt = new Date(now - 3 * 3_600_000)
    const day = brt.getUTCDay()
    const hour = brt.getUTCHours()
    const nowMinutes = hour * 60 + brt.getUTCMinutes()
    const inBusinessHours = day >= 1 && day <= 6 && hour >= 7 && hour < 22
    log.push(`⏰ Horário BRT: ${brt.toUTCString()} | dia=${day} hora=${hour}:${String(brt.getUTCMinutes()).padStart(2,'0')} → ${inBusinessHours ? '✅ dentro do horário comercial' : '❌ FORA do horário comercial (7h-22h seg-sáb)'}`)

    // 2. SDR config da empresa
    const { data: cfg } = await supabase
      .from('sdr_configs')
      .select('company_id, uazapi_instance_url, uazapi_token, agente_ativo')
      .eq('company_id', context.companyId)
      .maybeSingle()

    if (!cfg) {
      log.push('❌ sdr_configs: NÃO ENCONTRADO para esta empresa')
      return NextResponse.json({ ok: false, log })
    }
    log.push(`sdr_configs: agente_ativo=${cfg.agente_ativo} | token=${cfg.uazapi_token ? '✅ presente' : '❌ VAZIO'}`)
    if (!cfg.agente_ativo) log.push('⚠️ agente_ativo=false → cron pula esta empresa.')
    if (!cfg.uazapi_token) log.push('❌ uazapi_token vazio → impossível enviar.')

    // 3. Sequências de remarketing
    const { data: sequences } = await supabase
      .from('follow_sequences')
      .select('id, nome, ativo, canvas_config')
      .eq('company_id', context.companyId)
      .eq('tipo', 'remarketing')

    log.push(`\n📋 Sequências remarketing: ${sequences?.length ?? 0} encontradas`)

    for (const seq of sequences ?? []) {
      const rmCfg = (seq.canvas_config as any)?.remarketing
      const statusFiltros: string[] = rmCfg?.statusFiltros?.length ? rmCfg.statusFiltros : ['Remarketing']
      const diasInativo: number = rmCfg?.diasInativo ?? 0
      log.push(`  • [${seq.ativo ? '✅ ATIVA' : '❌ inativa'}] "${seq.nome}" (id=${seq.id})`)
      log.push(`    config: statusFiltros=${JSON.stringify(statusFiltros)} | diasInativo=${diasInativo}${diasInativo > 0 ? ` ⚠️ leads recentes bloqueados por ${diasInativo} dias` : ' ✅ sem bloqueio por inatividade'}`)

      const { data: steps } = await supabase
        .from('follow_steps')
        .select('id, dia_offset, horario, mensagem, tipo_mensagem')
        .eq('sequence_id', seq.id)
        .order('ordem')

      if (!steps?.length) {
        log.push('    ⚠️ SEM PASSOS — engine pula esta sequência')
        continue
      }

      for (const s of steps) {
        const [hh, mm] = (s.horario ?? '09:00').split(':').map(Number)
        const stepMinutes = hh * 60 + mm
        const tempoOk = nowMinutes >= stepMinutes - 5
        const temMensagem = !!(s.mensagem?.trim())
        log.push(`    Passo D+${s.dia_offset} às ${s.horario} | horário=${tempoOk ? '✅' : `❌ (agora=${hour}:${String(brt.getUTCMinutes()).padStart(2,'0')}, precisa de ${s.horario})`} | mensagem=${temMensagem ? '✅' : '❌ VAZIA'}`)
      }
    }

    // 4. Leads elegíveis (todos statusFiltros das sequências ativas)
    const allStatusFiltros = Array.from(new Set(
      (sequences ?? [])
        .filter((s: any) => s.ativo)
        .flatMap((s: any) => (s.canvas_config as any)?.remarketing?.statusFiltros ?? ['Remarketing'])
    ))
    log.push(`\n👤 Buscando leads com status em: ${JSON.stringify(allStatusFiltros)}`)

    const { data: leads } = await supabase
      .from('leads')
      .select('id, contact_name, whatsapp, status, updated_at')
      .eq('company_id', context.companyId)
      .in('status', allStatusFiltros.length > 0 ? allStatusFiltros : ['Remarketing'])

    log.push(`   ${leads?.length ?? 0} lead(s) encontrado(s)`)
    for (const l of leads ?? []) {
      const movedAt = new Date(l.updated_at ?? now).getTime()
      const dias = (now - movedAt) / 86_400_000

      // Per-sequence analysis
      const bloqueios: string[] = []
      for (const seq of (sequences ?? []).filter((s: any) => s.ativo)) {
        const rmCfg = (seq.canvas_config as any)?.remarketing
        const statusFiltros: string[] = rmCfg?.statusFiltros?.length ? rmCfg.statusFiltros : ['Remarketing']
        const diasInativo: number = rmCfg?.diasInativo ?? 0
        if (!statusFiltros.includes(l.status)) continue
        const steps = await supabase.from('follow_steps').select('id, dia_offset, horario').eq('sequence_id', seq.id).order('ordem')
        for (const s of steps.data ?? []) {
          const [hh, mm] = (s.horario ?? '09:00').split(':').map(Number)
          const stepMinutes = hh * 60 + mm
          const horaOk = nowMinutes >= stepMinutes - 5
          const diasOk = dias >= Math.max(s.dia_offset, diasInativo)
          if (!horaOk) bloqueios.push(`seq "${seq.nome}" passo D+${s.dia_offset}: ❌ horário (${s.horario} ainda não chegou)`)
          else if (!diasOk) bloqueios.push(`seq "${seq.nome}" passo D+${s.dia_offset}: ❌ inatividade (${dias.toFixed(1)}d < ${Math.max(s.dia_offset, diasInativo)}d necessários)`)
          else bloqueios.push(`seq "${seq.nome}" passo D+${s.dia_offset}: ✅ pronto para disparar`)
        }
      }

      log.push(`  • #${l.id} ${l.contact_name} | status="${l.status}" | whatsapp=${l.whatsapp ?? '❌ VAZIO'} | movido há ${dias.toFixed(1)}d`)
      for (const b of bloqueios) log.push(`    ${b}`)
    }

    // 5. Execuções recentes
    const { data: execs } = await supabase
      .from('follow_executions')
      .select('lead_id, step_id, status, executed_at')
      .eq('company_id', context.companyId)
      .order('executed_at', { ascending: false })
      .limit(15)

    log.push(`\n📊 Últimas execuções follow: ${execs?.length ?? 0}`)
    for (const e of execs ?? []) {
      log.push(`  • lead #${e.lead_id} step=${e.step_id} status=${e.status} em ${e.executed_at}`)
    }

    return NextResponse.json({ ok: true, log, nowBRT: brt.toISOString() })
  } catch (err: any) {
    log.push(`❌ Erro: ${err.message}`)
    return NextResponse.json({ ok: false, log, error: err.message })
  }
}
