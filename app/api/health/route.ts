import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';
import { withDatabaseReconnect } from '@/lib/db-reconnect';

export const dynamic = 'force-dynamic';

// Health check com query REAL no Supabase para manter conexão viva
export async function GET() {
  try {
    const dbStatus = await withDatabaseReconnect(async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leads')
        .select('id')
        .limit(1);

      if (error) throw error;
      return 'connected';
    });

    return NextResponse.json(
      {
        status: 'ok',
        db: dbStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        db: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}
