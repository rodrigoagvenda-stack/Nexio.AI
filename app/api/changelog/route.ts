import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  const service = createServiceClient()
  const { data, error } = await service
    .from('changelogs')
    .select('id, title, description, type, published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ changelogs: data ?? [] })
}
