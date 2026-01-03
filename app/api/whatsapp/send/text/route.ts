import { NextRequest, NextResponse } from 'next/server';
import { getUAZapiConfig, uazapiRequest } from '@/lib/utils/uazapi';

export async function POST(req: NextRequest) {
  try {
    const { companyId, phone, message } = await req.json();

    if (!companyId || !phone || !message) {
      return NextResponse.json(
        { error: 'companyId, phone e message são obrigatórios' },
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

    const result = await uazapiRequest(config, '/send/text', 'POST', {
      phone,
      message,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error sending text:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem' },
      { status: 500 }
    );
  }
}
