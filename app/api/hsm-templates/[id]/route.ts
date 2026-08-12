import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('hsm_templates')
    .delete()
    .eq('id', params.id)
    .eq('company_id', context.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('hsm_templates')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('company_id', context.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
