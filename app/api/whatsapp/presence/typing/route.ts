import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, companyId } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, message: 'Número de telefone é obrigatório' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { success: false, message: 'Company ID é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Buscar credentials da empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('whatsapp_instance, whatsapp_token')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { success: false, message: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    if (!company.whatsapp_instance || !company.whatsapp_token) {
      return NextResponse.json(
        { success: false, message: 'Credenciais do WhatsApp não configuradas' },
        { status: 400 }
      );
    }

    // 2. Enviar status "digitando..." via UAZapi
    try {
      const uazapiResponse = await fetch(
        `${company.whatsapp_instance}/presence/typing`,
        {
          method: 'POST',
          headers: {
            'apikey': company.whatsapp_token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phone: phoneNumber,
          }),
        }
      );

      const result = await uazapiResponse.json();

      if (!uazapiResponse.ok) {
        console.error('UAZapi typing error:', result);
        return NextResponse.json(
          { success: false, message: 'Erro ao enviar status de digitando' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Status de digitando enviado',
        data: result,
      });
    } catch (error) {
      console.error('Error calling UAZapi typing:', error);
      return NextResponse.json(
        { success: false, message: 'Erro ao chamar API do WhatsApp' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in typing presence endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
