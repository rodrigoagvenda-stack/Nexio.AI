import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('leads').select('id').limit(1);
    if (error) throw error;

    return NextResponse.json(
      { status: 'ok', db: 'connected', timestamp: new Date().toISOString(), uptime: process.uptime() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
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
      { status: 503, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  }
}
