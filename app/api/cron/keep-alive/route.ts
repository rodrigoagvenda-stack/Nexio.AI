import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { withDatabaseReconnect } from '@/lib/db-reconnect';

export const dynamic = 'force-dynamic';

/**
 * Endpoint protegido por Bearer token para cron job externo.
 * Faz query real no banco para manter conexão viva.
 *
 * Configurar no Easypanel:
 *   URL: https://seu-dominio.com/api/cron/keep-alive
 *   Method: GET
 *   Header: Authorization: Bearer SEU_CRON_SECRET
 *   Intervalo: a cada 5 minutos
 */
export async function GET(request: NextRequest) {
  // Validar Bearer token
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado no servidor' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await withDatabaseReconnect(async () => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true });

      if (error) throw error;
      return { leadsCount: count };
    });

    return NextResponse.json({
      status: 'alive',
      db: 'connected',
      leads: result.leadsCount,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
