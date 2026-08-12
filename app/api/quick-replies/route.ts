import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('quick_replies')
    .select('*')
    .eq('company_id', context.companyId)
    .order('shortcut')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { shortcut, content_type, content, media_url, attendant_id } = body

  if (!shortcut?.startsWith('/') || !content_type || !content) {
    return NextResponse.json({ error: 'shortcut deve começar com / e content é obrigatório' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('quick_replies')
    .insert({
      company_id: context.companyId,
      attendant_id: attendant_id ?? null,
      shortcut: shortcut.toLowerCase().trim(),
      content_type,
      content,
      media_url: media_url ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
