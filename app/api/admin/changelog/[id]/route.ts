import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-auth'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin(req)
  if (error) return error

  const body = await req.json()
  const { title, description, type, is_published } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) updates.title = title.trim()
  if (description !== undefined) updates.description = description.trim()
  if (type !== undefined) updates.type = type
  if (is_published !== undefined) {
    updates.is_published = is_published
    if (is_published) updates.published_at = new Date().toISOString()
  }

  const service = createServiceClient()
  const { data, error: dbErr } = await service
    .from('changelogs')
    .update(updates)
    .eq('id', params.id)
    .select()
    .maybeSingle()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ changelog: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin(req)
  if (error) return error

  const service = createServiceClient()
  const { error: dbErr } = await service
    .from('changelogs')
    .delete()
    .eq('id', params.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
