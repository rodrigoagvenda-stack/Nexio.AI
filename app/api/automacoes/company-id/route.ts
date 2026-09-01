/**
 * GET /api/automacoes/company-id
 * Retorna o company_id do usuário logado : usado só pra montar client-side
 * a URL do gatilho "Evento de webhook" das sequências (canvas).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'

export async function GET(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  return NextResponse.json({ companyId: context.companyId })
}
