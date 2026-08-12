import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('hsm_templates')
    .select('*')
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message?.includes('does not exist')) return NextResponse.json({ data: [], migration_pending: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { name, category, language, body: templateBody } = body

  if (!name || !category || !templateBody) {
    return NextResponse.json({ error: 'name, category e body são obrigatórios' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('hsm_templates')
    .insert({
      company_id: context.companyId,
      name,
      category,
      language: language ?? 'pt_BR',
      body: templateBody,
      status: 'pendente',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
