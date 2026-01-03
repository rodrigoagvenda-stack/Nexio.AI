import { NextRequest, NextResponse } from 'next/server';
import { getUAZapiConfig, uazapiRequest } from '@/lib/utils/uazapi';

export async function POST(req: NextRequest) {
  try {
    const { companyId, messageId, emoji } = await req.json();

    if (!companyId || !messageId || !emoji) {
      return NextResponse.json(
        { error: 'companyId, messageId e emoji são obrigatórios' },
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

    const result = await uazapiRequest(config, '/message/react', 'POST', {
      messageId,
      emoji,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error reacting to message:', error);
    return NextResponse.json(
      { error: 'Erro ao reagir à mensagem' },
      { status: 500 }
    );
  }
}
