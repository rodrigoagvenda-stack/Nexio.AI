import { NextRequest, NextResponse } from 'next/server';
import { getUAZapiConfig, uazapiRequest } from '@/lib/utils/uazapi';
import { requireAuth } from '@/lib/auth/require-auth';

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req);
  if (authError) return authError;

  try {
    const { messageId, emoji } = await req.json();

    if (!messageId || !emoji) {
      return NextResponse.json(
        { error: 'messageId e emoji são obrigatórios' },
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
