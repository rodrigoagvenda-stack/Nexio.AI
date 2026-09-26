import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createServiceClient } from '@/lib/supabase/server'
import { relatorioSemanal } from '@/lib/sdr/v3/metrics'

export const runtime = 'nodejs'
export const maxDuration = 120

// GET /api/sdr/v3/metrics?dias=14 : métricas da spec (seção 1) da própria empresa, janela atual contra a anterior.
export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error
  const dias = Math.min(Math.max(Number(request.nextUrl.searchParams.get('dias')) || 14, 1), 60)
  const data = await relatorioSemanal(createServiceClient(), context.companyId, dias)
  return NextResponse.json({ success: true, data })
}
