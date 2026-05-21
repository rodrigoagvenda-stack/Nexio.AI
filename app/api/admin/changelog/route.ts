import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req)
  if (error) return error

  const service = createServiceClient()
  const { data, error: dbErr } = await service
    .from('changelogs')
    .select('*')
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ changelogs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin(req)
  if (error) return error

  const body = await req.json()
  const { title, description, type, is_published } = body

  if (!title?.trim() || !description?.trim())
    return NextResponse.json({ error: 'Título e descrição obrigatórios.' }, { status: 422 })

  const service = createServiceClient()
  const { data, error: dbErr } = await service
    .from('changelogs')
    .insert({
      title: title.trim(),
      description: description.trim(),
      type: type ?? 'feature',
      is_published: is_published ?? false,
      published_at: is_published ? new Date().toISOString() : null,
    })
    .select()
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ changelog: data }, { status: 201 })
}
