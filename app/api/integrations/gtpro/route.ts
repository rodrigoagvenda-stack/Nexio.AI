import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('sdr_configs')
    .select('gtpro_api_key')
    .eq('company_id', context.companyId)
    .maybeSingle()

  return NextResponse.json({ connected: !!data?.gtpro_api_key })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json().catch(() => null)
  const apiKey = body?.api_key?.trim()
  if (!apiKey) return NextResponse.json({ error: 'api_key obrigatória' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('sdr_configs')
    .update({ gtpro_api_key: apiKey })
    .eq('company_id', context.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  await supabase
    .from('sdr_configs')
    .update({ gtpro_api_key: null })
    .eq('company_id', context.companyId)

  return NextResponse.json({ success: true })
}
