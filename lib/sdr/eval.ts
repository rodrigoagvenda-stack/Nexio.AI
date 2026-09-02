/**
 * Harness de avaliação do SDR : roda o motor REAL de produção
 * (processSdrMessage) de ponta a ponta, sem mandar WhatsApp de verdade,
 * contra uma empresa de QA isolada (id definido abaixo, nunca uma empresa
 * real). O dry-run é feito por companies.features.qa_dry_run=true : intercepta
 * só o envio final (dentro de sendWithHumanDelay em lib/sdr/engine.ts), mas
 * mensagens_do_whatsapp continua sendo gravada normal, então esse harness lê
 * a resposta de volta do banco, igual o Atendimento faria.
 *
 * Cada cenário reproduz um bug real achado ao vivo em produção (2026-09-02),
 * como regressão permanente. Rodar ANTES e DEPOIS de qualquer mudança no
 * núcleo do orquestrador (lib/sdr/engine.ts).
 *
 * Dois jeitos de rodar:
 * - Local : `npm run eval:sdr` (scripts/sdr-eval.ts), precisa de
 *   SUPABASE_SERVICE_ROLE_KEY no ambiente.
 * - Produção : POST /api/admin/qa/sdr-eval com Authorization: Bearer
 *   ${CRON_SECRET} (mesmo secret dos crons) — roda onde a chave já existe.
 */
import { createServiceClient } from '@/lib/supabase/server'
import { processSdrMessage, bufferMessage, type BufferedMessage } from '@/lib/sdr/engine'

const QA_COMPANY_ID = 31 // "Zaapply QA (não é cliente)" — nunca apontar isso pra uma empresa real
const LINK_FECHAMENTO = 'app.zaapply.com.br/briefing/fundacao-digital'

export interface EvalCheck {
  ok: boolean
  label: string
}

export interface EvalResult {
  passed: number
  failed: number
  checks: EvalCheck[]
  log: string[]
}

export async function runSdrEval(): Promise<EvalResult> {
  const supabase = createServiceClient()
  const checks: EvalCheck[] = []
  const log: string[] = []

  const say = (line: string) => {
    log.push(line)
    console.log(line)
  }

  const assert = (condition: boolean, label: string) => {
    checks.push({ ok: condition, label })
    say(`  ${condition ? '✓' : '✗'} ${label}`)
  }

  const assertBlockCap = (messages: string[], turnLabel: string) => {
    assert(messages.length <= 3, `${turnLabel}: no máximo 3 blocos (veio ${messages.length})`)
  }

  const resetLead = async (phone: string) => {
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('id')
      .eq('company_id', QA_COMPANY_ID)
      .eq('numero_de_telefone', phone)
      .maybeSingle()
    if (conv) {
      await supabase.from('mensagens_do_whatsapp').delete().eq('id_da_conversacao', conv.id)
      await supabase.from('conversas_do_whatsapp').delete().eq('id', conv.id)
    }
    await supabase.from('leads').delete().eq('company_id', QA_COMPANY_ID).eq('whatsapp', phone)
    await supabase.from('sdr_message_buffer').delete().eq('company_id', QA_COMPANY_ID).eq('phone', phone)
  }

  const getOutboundSince = async (phone: string, since: string): Promise<string[]> => {
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('id')
      .eq('company_id', QA_COMPANY_ID)
      .eq('numero_de_telefone', phone)
      .maybeSingle()
    if (!conv) return []
    const { data: msgs } = await supabase
      .from('mensagens_do_whatsapp')
      .select('texto_da_mensagem, carimbo_de_data_e_hora')
      .eq('id_da_conversacao', conv.id)
      .eq('direcao', 'outbound')
      .gte('carimbo_de_data_e_hora', since)
      .order('carimbo_de_data_e_hora', { ascending: true })
    return (msgs ?? []).map((m) => m.texto_da_mensagem ?? '')
  }

  /** Manda 1 mensagem simulada do lead e roda o motor real. Retorna só os
   * blocos de resposta gerados NESTA rodada (não o histórico inteiro). */
  const sendLeadMessage = async (phone: string, text: string, senderName = 'Lead Teste'): Promise<string[]> => {
    const since = new Date().toISOString()
    const msg: BufferedMessage = {
      content: text,
      type: 'text',
      // 20s no passado : pula o throttle de 15s do processSdrMessage
      // ("aguarda o lead terminar de digitar"), senão cada turno custa 15s à toa.
      timestamp: new Date(Date.now() - 20_000).toISOString(),
      messageId: `qa-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderName,
    }
    await bufferMessage(QA_COMPANY_ID, phone, msg, supabase)
    await processSdrMessage(QA_COMPANY_ID, phone)
    return getOutboundSince(phone, since)
  }

  const getChecklist = async (phone: string): Promise<Record<string, unknown> | null> => {
    const { data: conv } = await supabase
      .from('conversas_do_whatsapp')
      .select('checklist_atendimento')
      .eq('company_id', QA_COMPANY_ID)
      .eq('numero_de_telefone', phone)
      .maybeSingle()
    return (conv?.checklist_atendimento as Record<string, unknown> | null) ?? null
  }

  // ─── Cenários ──────────────────────────────────────────────────────

  const scenarioBriefingGate = async () => {
    say('\n[Cenário 1] Agendamento trava até o formulário de briefing ser preenchido')
    const phone = '5511900000002'
    await resetLead(phone)

    await sendLeadMessage(phone, 'Oi! Vi o anúncio e quero saber por que meu negócio não aparece no Google')
    const r2 = await sendLeadMessage(phone, 'Quero marcar uma reunião amanhã de manhã')
    const joined = r2.join(' \n ')

    assert(joined.includes(LINK_FECHAMENTO), 'resposta contém o link do formulário de briefing')
    assert(!/nome completo/i.test(joined), 'resposta NÃO pula direto pra coleta de nome/e-mail (Agente_de_Agendamento)')
    assertBlockCap(r2, 'turno 2')
  }

  const scenarioOptOutPersists = async () => {
    say('\n[Cenário 2] Lead que recusa explicitamente não pode ser abordado de novo')
    const phone = '5511900000003'
    await resetLead(phone)

    await sendLeadMessage(phone, 'Oi')
    await sendLeadMessage(phone, 'não quero mais informação')

    const checklist = await getChecklist(phone)
    assert(checklist?.lead_recusou === true, 'checklist_atendimento.lead_recusou = true depois da recusa')

    const r3 = await sendLeadMessage(phone, 'ok')
    assert(r3.length <= 1, `resposta seguinte é curta/sem novo pitch (veio ${r3.length} bloco(s))`)
  }

  const scenarioFechamentoSempreAparece = async () => {
    say('\n[Cenário 3] Bloco de Fechamento sempre entra na busca, mesmo com pergunta educativa')
    const phone = '5511900000004'
    await resetLead(phone)

    await sendLeadMessage(phone, 'Já tenho perfil no Google mas não sei postar, acho que poderia ter muito mais procura')
    const r2 = await sendLeadMessage(phone, 'preciso de manutenção, num é isso?')
    const joined = r2.join(' \n ')

    assert(joined.includes(LINK_FECHAMENTO), 'resposta contém o link de fechamento mesmo com pergunta fraseada de forma educativa')
    assertBlockCap(r2, 'turno 2')
  }

  // ─── Runner ────────────────────────────────────────────────────────

  const scenarios = [scenarioBriefingGate, scenarioOptOutPersists, scenarioFechamentoSempreAparece]
  for (const scenario of scenarios) {
    try {
      await scenario()
    } catch (err: any) {
      checks.push({ ok: false, label: `ERRO NO CENÁRIO: ${err?.message ?? err}` })
      say(`  ✗ ERRO NO CENÁRIO: ${err?.message ?? err}`)
    }
  }

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok).length

  say(`\n${'─'.repeat(50)}`)
  say(`Resultado: ${passed} passou, ${failed} falhou`)
  say('Nota: cenário "reunião fantasma" (calendário) ainda não incluído — precisa de um Google Calendar de teste conectado na empresa QA (id 31), sem usar o calendário real de nenhum cliente.')

  return { passed, failed, checks, log }
}
