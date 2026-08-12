import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_wa_numbers')
    .select('*')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { friendly_name, phone_number, phone_number_id, waba_id, token, provider } = body

  if (!friendly_name || !phone_number) {
    return NextResponse.json({ error: 'friendly_name e phone_number são obrigatórios' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('meta_wa_numbers')
    .insert({
      company_id: context.companyId,
      friendly_name,
      phone_number,
      phone_number_id: phone_number_id ?? null,
      waba_id: waba_id ?? null,
      token: token ?? null,
      provider: provider ?? 'meta',
      status: 'desconectado',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
