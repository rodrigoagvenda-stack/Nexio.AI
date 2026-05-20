import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { normalizePhone } from '@/lib/sdr/uazapi'

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request)
  if (authError) return authError

  const phone = request.nextUrl.searchParams.get('phone') ?? ''
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const service = createServiceClient()
  const normalized = normalizePhone(phone)
  const variants = [normalized, `+${normalized}`, normalized.replace(/^55/, '')]

  const { data } = await service
    .from('conversas_do_whatsapp')
    .select('id')
    .eq('company_id', context.companyId)
    .in('numero_de_telefone', variants)
    .maybeSingle()

  return NextResponse.json({ conversaId: data?.id ?? null })
}
