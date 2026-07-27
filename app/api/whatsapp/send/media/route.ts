import { NextRequest, NextResponse } from 'next/server';
import { getUAZapiConfig, uazapiRequest } from '@/lib/utils/uazapi';
import { requireAuth } from '@/lib/auth/require-auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req);
  if (authError) return authError;

  const rl = rateLimit({ key: `wa-send:${context.companyId}`, limit: 60, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 });

  try {
    const { phone, mediaUrl, mediaType, caption } = await req.json();

    if (!phone || !mediaUrl) {
      return NextResponse.json(
        { error: 'phone e mediaUrl são obrigatórios' },
        { status: 400 }
      );
    }

    const config = await getUAZapiConfig(context.companyId);
    if (!config) {
      return NextResponse.json(
        { error: 'Configuração UAZapi não encontrada' },
        { status: 404 }
      );
    }

    const result = await uazapiRequest(config, '/send/media', 'POST', {
      phone,
      mediaUrl,
      mediaType,
      caption,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error sending media:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mídia' },
      { status: 500 }
    );
  }
}
