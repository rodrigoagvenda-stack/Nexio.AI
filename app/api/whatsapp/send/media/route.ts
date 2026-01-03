import { NextRequest, NextResponse } from 'next/server';
import { getUAZapiConfig, uazapiRequest } from '@/lib/utils/uazapi';

export async function POST(req: NextRequest) {
  try {
    const { companyId, phone, mediaUrl, mediaType, caption } = await req.json();

    if (!companyId || !phone || !mediaUrl) {
      return NextResponse.json(
        { error: 'companyId, phone e mediaUrl são obrigatórios' },
        { status: 400 }
      );
    }

    const config = await getUAZapiConfig(companyId);
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
