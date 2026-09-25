import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { fireMetaCapiEvent } from '@/lib/meta/capi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DIAS = 60

// POST /api/meta/capi/resend : reenvia para a Meta as vendas fechadas que a Meta ainda não aceitou,
// com a data real do fechamento. Vendas com mais de 7 dias a Meta costuma recusar; o resultado de cada uma volta na resposta.
export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const desde = new Date(Date.now() - DIAS * 86_400_000).toISOString()

  const { data: leads } = await supabase
    .from('leads')
    .select('id, contact_name, company_name, whatsapp, project_value, closed_at')
    .eq('company_id', context.companyId)
    .eq('status', 'Fechado')
    .not('closed_at', 'is', null)
    .not('whatsapp', 'is', null)
    .gte('closed_at', desde)
    .order('closed_at', { ascending: true })
    .limit(200)

  const rows = leads ?? []
  const phones = rows.map((l) => String(l.whatsapp).replace(/\D/g, ''))
  const { data: convs } = phones.length
    ? await supabase.from('conversas_do_whatsapp').select('id, numero_de_telefone').eq('company_id', context.companyId).in('numero_de_telefone', phones)
    : { data: [] as { id: number; numero_de_telefone: string }[] }
  const convByPhone = new Map((convs ?? []).map((c) => [c.numero_de_telefone as string, c.id as number]))
  const convIds = Array.from(convByPhone.values())
  const { data: ok } = convIds.length
    ? await supabase.from('conversions_api_log').select('conversation_id').in('conversation_id', convIds).eq('success', true)
    : { data: [] as { conversation_id: number }[] }
  const accepted = new Set((ok ?? []).map((r) => r.conversation_id as number))

  const results: { lead: string; closed_at: string; ok: boolean; message: string | null }[] = []
  for (const l of rows) {
    const phone = String(l.whatsapp).replace(/\D/g, '')
    const convId = convByPhone.get(phone)
    const name = (l.contact_name || l.company_name || `Lead ${l.id}`) as string
    if (convId && accepted.has(convId)) continue
    const r = await fireMetaCapiEvent(supabase, {
      companyId: context.companyId,
      phone: l.whatsapp as string,
      valueCents: l.project_value ? Math.round(Number(l.project_value) * 100) : null,
      eventIdSeed: `lead_${l.id}`,
      eventTime: Math.floor(new Date(l.closed_at as string).getTime() / 1000),
    })
    results.push({ lead: name, closed_at: l.closed_at as string, ok: r.ok, message: r.ok ? null : (r.skipped ?? r.error ?? 'A Meta recusou o evento') })
  }

  return NextResponse.json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results })
}
