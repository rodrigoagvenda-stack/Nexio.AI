import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOutboundCaller, isOutboundAuthError } from '@/lib/outbound-auth'

export async function GET() {
  const caller = await resolveOutboundCaller()
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const supabase = createServiceClient()
  const { data: templates, error } = await supabase
    .from('outbound_templates')
    .select('*')
    .or(`company_id.eq.${caller.companyId},company_id.is.null`)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, templates: templates ?? [] })
}

export async function POST(request: NextRequest) {
  const caller = await resolveOutboundCaller(true)
  if (isOutboundAuthError(caller)) {
    return NextResponse.json({ success: false, message: caller.message }, { status: caller.status })
  }

  const body = await request.json().catch(() => ({}))
  const { categoria, prompt_sistema, exemplos } = body
  if (!categoria?.trim() || !prompt_sistema?.trim()) {
    return NextResponse.json({ success: false, message: 'Preencha categoria e prompt' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: template, error } = await supabase
    .from('outbound_templates')
    .insert({
      company_id: caller.companyId,
      categoria,
      prompt_sistema,
      exemplos: exemplos ?? null,
      ativo: true,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, template })
}
