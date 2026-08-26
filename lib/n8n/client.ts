import { createClient } from '@/lib/supabase/server';

interface N8NResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export async function extractLeadsFromMaps(
  startUrl: string,
  quantity: number,
  companyId: number,
  sessionId?: string
): Promise<N8NResponse> {
  try {
    console.log('[Maps] Iniciando extração para company_id:', companyId);

    // Buscar webhook_maps_url direto da empresa
    const supabase = await createClient();

    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('webhook_maps_url, webhook_maps_enabled')
      .eq('id', companyId)
      .single();

    if (companyError || !companyData?.webhook_maps_url) {
      throw new Error('Webhook Maps não configurado para esta empresa. Configure em Admin > Empresas.');
    }

    if (!companyData.webhook_maps_enabled) {
      throw new Error('Webhook Maps está desativado para esta empresa. Ative em Admin > Empresas.');
    }

    const webhookUrl = companyData.webhook_maps_url;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startUrls: [{ url: startUrl }],
        company_id: companyId,
        quantity,
        session_id: sessionId,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[Maps] N8N request failed (${response.status}):`, responseText.substring(0, 500));
      if (response.status === 404) {
        throw new Error('Workflow de extração não encontrado no n8n. Verifique se o workflow está ativo em modo Produção.');
      }
      throw new Error(`Falha ao acionar automação de extração (status ${response.status}). Verifique o workflow no n8n.`);
    }

    if (!responseText || responseText.trim() === '') {
      console.warn('[Maps] n8n retornou resposta vazia! Considerando sucesso.');
      return { success: true, message: 'Webhook executado (resposta vazia)', data: {} };
    }

    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (parseError) {
      console.error('[Maps] ERRO ao parsear JSON:', parseError, responseText.substring(0, 200));
      throw new Error('Automação de extração retornou resposta inválida. Verifique o workflow no n8n.');
    }
  } catch (error) {
    console.error('[Maps] ERRO na extração:', error);
    throw error;
  }
}
