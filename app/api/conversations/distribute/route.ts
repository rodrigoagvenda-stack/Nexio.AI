import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { distributeQueuedConversations } from '@/lib/sdr/distribute'

// Distribui conversas da fila para atendentes livres respeitando limites por atendente.
// Pode ser chamado via POST por: cron a cada 5min, ou manualmente. O handoff
// em tempo real (Pausar_conversa em engine.ts) chama distributeQueuedConversations
// direto, sem passar por esta rota (não tem sessão de usuário em background).
export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const supabase = createServiceClient()
  const result = await distributeQueuedConversations(context.companyId, supabase)
  return NextResponse.json(result)
}
