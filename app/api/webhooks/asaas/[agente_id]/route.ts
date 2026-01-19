import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/webhooks/asaas/[agente_id] - Recebe webhook do Asaas
export async function POST(
  request: Request,
  { params }: { params: { agente_id: string } }
) {
  try {
    const supabase = await createClient();

    // Busca agente pelo webhook_id
    const { data: agente, error: agenteError } = await supabase
      .from('asaas_agentes')
      .select('*')
      .eq('webhook_id', params.agente_id)
      .eq('active', true)
      .single();

    if (agenteError || !agente) {
      return NextResponse.json(
        { error: 'Webhook não encontrado ou inativo' },
        { status: 404 }
      );
    }

    // Pega o payload
    const payload = await request.json();

    // Valida assinatura (opcional - Asaas envia header asaas-access-token)
    const asaasToken = request.headers.get('asaas-access-token');

    // Se tiver secret configurado, valida
    if (agente.webhook_secret && asaasToken) {
      if (asaasToken !== agente.webhook_secret) {
        return NextResponse.json(
          { error: 'Token inválido' },
          { status: 403 }
        );
      }
    }

    // Processa evento
    const event = payload.event; // PAYMENT_CREATED, PAYMENT_UPDATED, etc
    const payment = payload.payment;

    if (!payment) {
      return NextResponse.json(
        { error: 'Payload inválido' },
        { status: 400 }
      );
    }

    // Busca cobrança existente
    const { data: existingCobranca } = await supabase
      .from('asaas_cobrancas')
      .select('*')
      .eq('asaas_id', payment.id)
      .single();

    const cobrancaData = {
      agente_id: agente.id,
      asaas_id: payment.id,
      cliente_nome: payment.customer?.name || 'N/A',
      cliente_email: payment.customer?.email || 'N/A',
      cliente_cpf_cnpj: payment.customer?.cpfCnpj || null,
      valor: parseFloat(payment.value || '0'),
      status: payment.status, // PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED
      vencimento: payment.dueDate,
      pago_em: payment.paymentDate || null,
      webhook_payload: payload,
      updated_at: new Date().toISOString(),
    };

    if (existingCobranca) {
      // Atualiza
      const { error: updateError } = await supabase
        .from('asaas_cobrancas')
        .update(cobrancaData)
        .eq('id', existingCobranca.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      // Insere nova
      const { error: insertError } = await supabase
        .from('asaas_cobrancas')
        .insert(cobrancaData);

      if (insertError) {
        throw insertError;
      }
    }

    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error('Erro ao processar webhook Asaas:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar webhook' },
      { status: 500 }
    );
  }
}
