import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

// GET /api/outbound/pause : estado atual (pra pintar o botão certo ao carregar a página)
export async function GET() {
  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('companies')
    .select('outbound_pausado')
    .eq('id', caller.companyId)
    .single()

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  return NextResponse.json({ success: true, pausado: data.outbound_pausado })
}

// PATCH /api/outbound/pause : liga/desliga o disparo de outbound pra empresa do usuário
export async function PATCH(request: NextRequest) {
  const caller = await resolveOutboundCaller(true)
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const { pausado } = await request.json()
  if (typeof pausado !== 'boolean') {
    return NextResponse.json({ success: false, message: 'Campo pausado deve ser boolean' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('companies')
    .update({ outbound_pausado: pausado })
    .eq('id', caller.companyId)

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  return NextResponse.json({ success: true, pausado })
}
