/**
 * Empresa-sombra de QA : generaliza o que foi feito manualmente via SQL pra
 * Grupo Venda (company_id=30 → sombra 31) pra qualquer empresa real. Uma
 * empresa-sombra é uma cópia isolada, com agente_ativo/tokens_unlimited=true
 * e features.qa_dry_run=true (nunca manda WhatsApp de verdade, ver
 * sendWithHumanDelay em lib/sdr/engine.ts), clonando o conteúdo real do
 * wizard da empresa de origem : permite rodar processSdrMessage de verdade
 * sem tocar em dado real de cliente nenhum.
 *
 * companies.is_shadow_company / shadow_of_company_id marcam quem é sombra :
 * todo lugar que faz um scan amplo de `companies` (crons, telas de admin)
 * precisa filtrar is_shadow_company=false, senão uma sombra pode ser
 * confundida com cliente real (ex: entrar na fila de outbound de verdade).
 */
import { createServiceClient } from '@/lib/supabase/server'

type Supabase = ReturnType<typeof createServiceClient>

export async function ensureShadowCompany(realCompanyId: number, supabase: Supabase): Promise<number> {
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('shadow_of_company_id', realCompanyId)
    .eq('is_shadow_company', true)
    .maybeSingle()

  const shadowId = existing?.id ?? (await createShadowCompany(realCompanyId, supabase))

  // Resincroniza sempre : garante que o teste reflete o conteúdo ATUAL do
  // wizard, não uma foto antiga de quando a sombra foi criada.
  await cloneWizardContent(realCompanyId, shadowId, supabase)

  return shadowId
}

async function createShadowCompany(realCompanyId: number, supabase: Supabase): Promise<number> {
  const { data: real } = await supabase
    .from('companies')
    .select('name, features')
    .eq('id', realCompanyId)
    .single()

  const realFeatures = (real?.features as Record<string, boolean> | null) ?? {}

  const { data: shadow, error } = await supabase
    .from('companies')
    .insert({
      name: `${real?.name ?? `Empresa ${realCompanyId}`} (teste interno)`,
      agente_ativo: true,
      is_active: true,
      tokens_unlimited: true,
      is_shadow_company: true,
      shadow_of_company_id: realCompanyId,
      plan_type: 'basic',
      features: {
        qa_dry_run: true,
        // Copia só o que os cenários de teste genéricos precisam pra ficar
        // realista (ex: cenário de trava do formulário de briefing). NUNCA
        // outbound : é uma sombra de teste, não deve entrar em nenhuma fila
        // de disparo real, mesmo com o filtro is_shadow_company já cortando
        // isso hoje — não faz sentido testar outbound aqui de qualquer jeito.
        briefing: realFeatures.briefing === true,
        places_analysis: realFeatures.places_analysis === true,
      },
    })
    .select('id')
    .single()

  if (error || !shadow) throw new Error(`ensureShadowCompany: falha ao criar empresa-sombra: ${error?.message}`)
  return shadow.id
}

async function cloneWizardContent(realCompanyId: number, shadowId: number, supabase: Supabase): Promise<void> {
  // ── sdr_configs ──────────────────────────────────────────────────────
  const { data: realConfig } = await supabase
    .from('sdr_configs')
    .select('agent_type, prompt, whatsapp_provider, billing_recurring, google_calendar_id')
    .eq('company_id', realCompanyId)
    .maybeSingle()

  await supabase.from('sdr_configs').upsert(
    {
      company_id: shadowId,
      agent_type: realConfig?.agent_type ?? 'atendimento_venda',
      prompt: realConfig?.prompt ?? '',
      agente_ativo: true,
      uazapi_instance_name: 'qa-shadow-dryrun',
      uazapi_instance_url: 'https://nexioai.uazapi.com',
      uazapi_token: 'dryrun-fake-token', // nunca usado de verdade, qa_dry_run pula o envio real
      whatsapp_provider: realConfig?.whatsapp_provider ?? 'uazapi',
      billing_recurring: realConfig?.billing_recurring ?? false,
      // google_calendar_id fica de fora de propósito : não reusar o calendário
      // real do cliente pra criar/apagar evento de teste nele.
    },
    { onConflict: 'company_id' }
  )

  // ── sdr_flows : pega o fluxo ativo principal (inbound/ambos) da empresa real ──
  const { data: realFlow } = await supabase
    .from('sdr_flows')
    .select('*')
    .eq('company_id', realCompanyId)
    .eq('ativo', true)
    .in('tipo', ['inbound', 'ambos'])
    .limit(1)
    .maybeSingle()

  if (!realFlow) return // empresa real sem fluxo configurado ainda : nada pra clonar

  // Remove sombra antiga (flow + documents) antes de reclonar, pra sempre
  // refletir o conteúdo atual do wizard, não acumular versões velhas. Uma
  // empresa-sombra só tem 1 fluxo por vez, então todo documents dela é
  // descartável aqui, sem precisar filtrar por flow_id.
  await supabase.from('documents').delete().eq('company_id', shadowId)
  await supabase.from('sdr_flows').delete().eq('company_id', shadowId)

  const { data: newFlow, error: flowErr } = await supabase
    .from('sdr_flows')
    .insert({
      company_id: shadowId,
      nome: `${realFlow.nome} (sombra)`,
      tipo: realFlow.tipo,
      ativo: true,
      orchestrator_prompt: realFlow.orchestrator_prompt,
      conhecimento_ativo: realFlow.conhecimento_ativo,
      objecoes_ativo: realFlow.objecoes_ativo,
      vector_table_conhecimento: realFlow.vector_table_conhecimento,
      vector_table_objecoes: realFlow.vector_table_objecoes,
      inbox_mode: realFlow.inbox_mode,
      event_title_template: realFlow.event_title_template,
    })
    .select('id')
    .single()

  if (flowErr || !newFlow) throw new Error(`ensureShadowCompany: falha ao clonar sdr_flows: ${flowErr?.message}`)

  // ── documents (RAG : conhecimento + objeções) ───────────────────────
  const { data: realDocs } = await supabase
    .from('documents')
    .select('content, metadata, embedding')
    .eq('company_id', realCompanyId)
    .contains('metadata', { flow_id: realFlow.id })

  if (realDocs?.length) {
    const cloned = realDocs.map((d) => ({
      company_id: shadowId,
      content: d.content,
      metadata: { ...(d.metadata as Record<string, unknown>), flow_id: newFlow.id },
      embedding: d.embedding,
    }))
    await supabase.from('documents').insert(cloned)
  }
}
