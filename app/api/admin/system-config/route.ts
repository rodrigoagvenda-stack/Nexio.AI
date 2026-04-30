import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { invalidateSystemConfigCache } from '@/lib/sdr/system-config'

export const dynamic = 'force-dynamic'

const ALLOWED_KEYS = ['GROQ_API_KEY', 'OPENAI_API_KEY']

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('system_config')
    .select('key, updated_at')
    .in('key', ALLOWED_KEYS)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function PUT(request: NextRequest) {
  let body: { key: string; value: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { key, value } = body

  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Chave não permitida' }, { status: 400 })
  }

  if (typeof value !== 'string') {
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('system_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  invalidateSystemConfigCache()

  return NextResponse.json({ ok: true })
}
