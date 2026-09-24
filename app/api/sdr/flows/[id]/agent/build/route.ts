import { NextRequest, NextResponse, after } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getPlatformConfig } from '@/lib/platform-config'
import { processKnowledgeText } from '@/lib/sdr/rag'
import { generateConhecimento, generateObjecoes } from '@/lib/sdr/questionnaire'
import { composeAnswers, missingRequired, sanitizeAssistant } from '@/lib/sdr/assistant'
import type { SdrVariables } from '@/lib/sdr/templates'
import { logCompanyNotice } from '@/lib/notifications/server'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/sdr/flows/[id]/agent/build : cria o agente a partir do assistente (base de conhecimento + base de objeções).
//   Responde na hora com { buildId } e o trabalho continua no servidor, então a pessoa pode sair da tela.
// GET  /api/sdr/flows/[id]/agent/build?id=... : andamento real da criação.

// Uma criação que passou disso sem terminar foi interrompida (ex.: o servidor reiniciou)
const STALE_MS = 10 * 60_000

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError
  const { id: flowId } = await props.params

  const service = createServiceClient()
  const { data: flow } = await service.from('sdr_flows').select('id').eq('id', flowId).eq('company_id', context.companyId).single()
  if (!flow) return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const answers = sanitizeAssistant(body.answers)
  const variables = ((body.variables && typeof body.variables === 'object') ? body.variables : {}) as SdrVariables

  const missing = missingRequired(answers)
  if (missing.length) {
    return NextResponse.json({ error: `Falta preencher: ${missing.map((m) => m.label).join(', ')}` }, { status: 400 })
  }

  const platformConfig = await getPlatformConfig()
  const openaiKey = platformConfig?.openai_api_key
  if (!openaiKey) {
    return NextResponse.json({ error: 'Chave OpenAI não configurada. Vá em Admin, Configurações de Plataforma.' }, { status: 422 })
  }

  // Duplo clique: se já existe uma criação em andamento para este fluxo, devolve a mesma
  const { data: running } = await service
    .from('sdr_agent_builds')
    .select('id, created_at')
    .eq('company_id', context.companyId)
    .eq('flow_id', flowId)
    .eq('status', 'running')
    .gte('created_at', new Date(Date.now() - STALE_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (running) return NextResponse.json({ buildId: running.id, alreadyRunning: true }, { status: 202 })

  const agentName = answers.agentName.trim()
  const { data: build, error: insertError } = await service
    .from('sdr_agent_builds')
    .insert({ company_id: context.companyId, flow_id: flowId, agent_name: agentName })
    .select('id')
    .single()
  if (insertError || !build) {
    console.error('[agent/build] não criou o registro:', insertError?.message)
    return NextResponse.json({ error: 'Não foi possível iniciar a criação. Tente de novo.' }, { status: 500 })
  }

  const vars: SdrVariables = { ...variables, nome_agente: agentName }
  after(() => runBuild({ buildId: build.id, companyId: context.companyId, flowId, openaiKey, answers, vars }))
  return NextResponse.json({ buildId: build.id }, { status: 202 })
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError
  const { id: flowId } = await props.params

  const buildId = request.nextUrl.searchParams.get('id')
  if (!buildId || !/^[0-9a-f-]{36}$/i.test(buildId)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const service = createServiceClient()
  const { data: build } = await service
    .from('sdr_agent_builds')
    .select('id, status, roteiro_done, objecoes_done, error, chunks, agent_name, created_at')
    .eq('id', buildId)
    .eq('company_id', context.companyId)
    .eq('flow_id', flowId)
    .maybeSingle()
  if (!build) return NextResponse.json({ error: 'Criação não encontrada' }, { status: 404 })

  if (build.status === 'running' && Date.now() - new Date(build.created_at).getTime() > STALE_MS) {
    const message = 'A criação demorou mais que o normal e foi interrompida. Tente de novo.'
    await service.from('sdr_agent_builds').update({ status: 'error', error: message, finished_at: new Date().toISOString() }).eq('id', buildId)
    return NextResponse.json({ ...build, status: 'error', error: message })
  }
  return NextResponse.json(build)
}

async function runBuild(p: {
  buildId: string
  companyId: number
  flowId: string
  openaiKey: string
  answers: ReturnType<typeof sanitizeAssistant>
  vars: SdrVariables
}) {
  const service = createServiceClient()
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: p.openaiKey })
  const composed = composeAnswers(p.answers)

  const mark = (patch: Record<string, unknown>) => service.from('sdr_agent_builds').update(patch).eq('id', p.buildId)

  // As duas bases não dependem uma da outra: geram ao mesmo tempo e cada uma marca o seu andamento
  const run = async (kind: 'conhecimento' | 'objecoes') => {
    const text = kind === 'conhecimento'
      ? await generateConhecimento(openai, composed, p.vars)
      : await generateObjecoes(openai, composed, p.vars)
    const result = await processKnowledgeText({
      companyId: p.companyId,
      flowId: p.flowId,
      filename: `${kind}_monte-o-seu.txt`,
      text,
      tableType: kind,
      companyName: p.vars.nome_empresa ?? null,
    })
    await mark(kind === 'conhecimento' ? { roteiro_done: true } : { objecoes_done: true })
    return result.chunks
  }

  const [roteiro, objecoes] = await Promise.allSettled([run('conhecimento'), run('objecoes')])

  if (roteiro.status === 'fulfilled' && objecoes.status === 'fulfilled') {
    await mark({ status: 'done', chunks: roteiro.value + objecoes.value, finished_at: new Date().toISOString() })
    const name = p.answers.agentName.trim()
    await logCompanyNotice(service, {
      companyId: p.companyId,
      action: 'sdr_agent_ready',
      description: `${name} está pronta. Teste a conversa e corrija o que quiser: os avisos da revisão continuam na aba Conhecimento.`,
      metadata: { flow_id: p.flowId, build_id: p.buildId },
      dedupeKey: `agent_ready:${p.buildId}`,
    })
    return
  }

  const failed = roteiro.status === 'rejected' ? roteiro : objecoes.status === 'rejected' ? objecoes : null
  const reason = failed && failed.status === 'rejected' ? failed.reason : null
  console.error(`[agent/build:${p.companyId}] falhou:`, reason?.message ?? reason)
  const raw = String(reason?.message ?? '')
  const friendly = /timeout|ECONNRESET/i.test(raw)
    ? 'Tempo limite excedido. Verifique se a chave OpenAI está configurada e tente de novo.'
    : /truncada/i.test(raw)
    ? 'A resposta da IA ficou grande demais. Reduza um pouco os detalhes e tente de novo.'
    : 'Não foi possível criar o agente agora. Suas respostas continuam salvas: tente de novo.'
  await mark({ status: 'error', error: friendly, finished_at: new Date().toISOString() })
}
