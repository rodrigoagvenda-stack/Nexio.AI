import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

// Insere um chunk na base, mas antes checa similaridade semântica contra o
// que já existe (mesma empresa+flow+tipo) : se achar um chunk quase igual,
// SUBSTITUI em vez de empilhar duplicata. Achado real : a versão anterior
// era só INSERT cego, sem checar nada, então clicar "Aplicar" mais de uma
// vez no mesmo gap (ou em gap parecido com o que já existia) ia empilhando
// chunks redundantes pra sempre, competindo entre si na busca.
type DiagDocType = 'diagnostico_conhecimento' | 'diagnostico_objecoes'
const SIMILARITY_DUPLICATE_THRESHOLD = 0.87

// pgvector volta via supabase-js como string "[0.1,0.2,...]" em alguns
// clients/versões, e como number[] em outros : aceita os dois formatos em
// vez de assumir um só (silenciosamente não comparava nada se viesse string).
function parseEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[]
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as number[]
    } catch { /* ignora, cai no null abaixo */ }
  }
  return null
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function appendChunk(params: {
  companyId: number
  flowId: string
  tableType: DiagDocType
  text: string
  openaiKey: string
}) {
  const { companyId, flowId, tableType, text, openaiKey } = params
  const service = createServiceClient()

  // Busca docs existentes desse tipo, já trazendo embedding pra comparar
  const { data: existing } = await service
    .from('documents')
    .select('id, embedding, metadata')
    .eq('company_id', companyId)
    .contains('metadata', { flow_id: flowId, doc_type: tableType })
    .order('created_at', { ascending: false })
    .limit(50)

  let filename = tableType === 'diagnostico_objecoes' ? 'diagnostico_objecoes.txt' : 'diagnostico_conhecimento.txt'
  let nextIndex = 0

  if (existing && existing.length > 0) {
    // Usa o filename do doc mais recente (é o que o usuário subiu)
    filename = existing[0].metadata?.filename ?? filename
    // Maior chunk_index entre todos os docs desse tipo
    const maxIdx = Math.max(...existing.map((d) => d.metadata?.chunk_index ?? 0))
    nextIndex = maxIdx + 1
  }

  // Gera embedding do novo chunk
  const { default: OpenAIClass } = await import('openai')
  const openai = new OpenAIClass({ apiKey: openaiKey })
  const embRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  const embedding = embRes.data[0].embedding

  // Acha o chunk existente mais parecido semanticamente com o novo
  let bestMatch: { id: number; similarity: number } | null = null
  for (const doc of existing ?? []) {
    const docEmbedding = parseEmbedding(doc.embedding)
    if (!docEmbedding) continue
    const sim = cosineSimilarity(embedding, docEmbedding)
    if (!bestMatch || sim > bestMatch.similarity) bestMatch = { id: doc.id, similarity: sim }
  }

  if (bestMatch && bestMatch.similarity >= SIMILARITY_DUPLICATE_THRESHOLD) {
    // Já existe algo quase igual : substitui o conteúdo em vez de duplicar
    const { error } = await service
      .from('documents')
      .update({ content: text, embedding })
      .eq('id', bestMatch.id)
    if (error) throw new Error(`Erro ao atualizar chunk existente: ${error.message}`)
    return
  }

  const { error } = await service.from('documents').insert({
    company_id: companyId,
    content: text,
    embedding,
    metadata: { flow_id: flowId, doc_type: tableType, filename, chunk_index: nextIndex },
  })

  if (error) throw new Error(`Erro ao salvar na base: ${error.message}`)
}

// POST /api/sdr/fix-gap
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single()
    if (!userData) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const body = await req.json()
    const { gap, persona, dry_run = false, fix_text_override } = body

    if (!gap?.id || !gap?.scenario) {
      return NextResponse.json({ error: 'Gap inválido' }, { status: 400 })
    }

    const service = createServiceClient()

    // Busca openai_key
    const { data: cfg } = await service
      .from('sdr_configs')
      .select('openai_key')
      .eq('company_id', userData.company_id)
      .single()

    // Busca o flow ativo
    const { data: flowRow } = await service
      .from('sdr_flows')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('ativo', true)
      .limit(1)
      .single()

    const flowId = flowRow?.id ?? null

    // Resolve OpenAI key
    let openaiKey: string | null = null
    if (process.env.OPENAI_API_KEY) {
      openaiKey = process.env.OPENAI_API_KEY
    } else if (cfg?.openai_key) {
      openaiKey = decrypt(cfg.openai_key)
    } else {
      const { data: rows } = await service
        .from('platform_config')
        .select('key, value, is_encrypted')
        .eq('key', 'openai_api_key')
      const row = rows?.[0]
      if (row?.value) openaiKey = row.is_encrypted ? decrypt(row.value) : row.value
    }

    if (!openaiKey) {
      return NextResponse.json({ error: 'Chave OpenAI não configurada' }, { status: 400 })
    }

    // doc_type separado para fixes — nunca apagado pelo upload normal do wizard
    const tableType: DiagDocType =
      gap.source === 'Base de Objeções' ? 'diagnostico_objecoes' : 'diagnostico_conhecimento'

    // Se fix_text_override: pula GPT e embeda o texto editado pelo usuário
    const overrideText = (fix_text_override as string | undefined)?.trim()
    if (overrideText) {
      if (!flowId) {
        return NextResponse.json({ error: 'Nenhum fluxo SDR ativo encontrado.' }, { status: 400 })
      }
      await appendChunk({ companyId: userData.company_id, flowId, tableType, text: overrideText, openaiKey })
      return NextResponse.json({ ok: true, fix_text: overrideText, insert_in: tableType })
    }

    // Gera script via GPT
    const empresaNome = persona?.empresa ?? persona?.nome_empresa ?? 'sua empresa'
    const produto = persona?.produto ?? 'seu produto/serviço'

    const systemPrompt = `Você é um especialista em scripts de vendas para WhatsApp no mercado brasileiro.
Sua resposta é APENAS o script pronto — nada mais.

PROIBIDO:
- Frases de introdução ("Entendi!", "Claro!", "Sem problemas", "Aqui está o script", etc.)
- Explicações, títulos, cabeçalhos ou comentários
- Qualquer texto que não seja parte do script em si

OBRIGATÓRIO:
- Começar diretamente com a primeira mensagem do script
- Tom WhatsApp: informal mas profissional
- Use [variavel] apenas quando for óbvio que o usuário deve substituir
- Máximo 5 mensagens curtas, cada uma numa linha separada
- NUNCA invente preços, valores ou links — use o que foi informado ou [variavel]

Contexto do negócio:
- Empresa: ${empresaNome}
- Produto/Serviço: ${produto}`

    const userPrompt = `Lacuna: "${gap.scenario}"
O que falha: ${gap.what_fails}
Onde será adicionado: ${gap.source}
Instrução: ${gap.suggestion}
Exemplo de falha: ${gap.example}

Gere o script que deve ser adicionado na ${gap.source}.`

    const { default: OpenAIClass } = await import('openai')
    const client = new OpenAIClass({ apiKey: openaiKey })

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const fixText = response.choices[0].message.content?.trim() ?? ''
    if (!fixText) {
      return NextResponse.json({ error: 'Não foi possível gerar o script.' }, { status: 500 })
    }

    // dry_run: retorna para o usuário revisar antes de aplicar
    if (dry_run) {
      return NextResponse.json({ ok: true, fix_text: fixText, insert_in: tableType })
    }

    if (!flowId) {
      return NextResponse.json({ error: 'Nenhum fluxo SDR ativo encontrado.' }, { status: 400 })
    }

    await appendChunk({ companyId: userData.company_id, flowId, tableType, text: fixText, openaiKey })
    return NextResponse.json({ ok: true, fix_text: fixText, insert_in: tableType })
  } catch (err: any) {
    console.error('[sdr/fix-gap] erro:', err)
    return NextResponse.json({ error: err?.message ?? 'Erro interno' }, { status: 500 })
  }
}
