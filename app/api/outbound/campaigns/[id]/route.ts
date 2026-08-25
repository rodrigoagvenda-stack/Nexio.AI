import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

const ALLOWED_FIELDS = ['converteu_em'] as const

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const caller = await resolveOutboundCaller(true)
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const body = await request.json().catch(() => ({}))
  const payload: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) payload[field] = body[field]
  }
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ success: false, message: 'Nenhum campo válido pra atualizar' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('outbound_campaigns')
    .update(payload)
    .eq('id', id)
    .eq('company_id', caller.companyId)

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
