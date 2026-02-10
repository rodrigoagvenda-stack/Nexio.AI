import { createClient } from '@/lib/supabase/server';

interface N8NResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export async function extractLeadsFromMaps(
  startUrl: string,
  quantity: number,
  companyId: number
): Promise<N8NResponse> {
  try {
    console.log('[Maps] Iniciando extração para company_id:', companyId);

    // Buscar configuração do webhook do banco de dados
    const supabase = await createClient();
    console.log('[Maps] Supabase client criado');

    const { data: webhookConfig, error: configError } = await supabase
      .from('n8n_webhook_config')
      .select('*')
      .eq('webhook_type', 'maps')
      .eq('is_active', true)
      .single();

    console.log('[Maps] Webhook config:', webhookConfig);
    console.log('[Maps] Config error:', configError);

    if (configError || !webhookConfig) {
      throw new Error('Webhook Maps não configurado. Configure em Admin > Webhooks & APIs.');
    }

    console.log('[Maps] Webhook URL:', webhookConfig.webhook_url);
    console.log('[Maps] Auth type:', webhookConfig.auth_type);

    // Criar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Adicionar autenticação baseada no tipo
    if (webhookConfig.auth_type === 'basic' && webhookConfig.auth_username && webhookConfig.auth_password) {
      const basicAuth = Buffer.from(
        `${webhookConfig.auth_username}:${webhookConfig.auth_password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
      console.log('[Maps] Basic Auth configurado');
    } else if (webhookConfig.auth_type === 'bearer' && webhookConfig.auth_token) {
      headers['Authorization'] = `Bearer ${webhookConfig.auth_token}`;
      console.log('[Maps] Bearer Auth configurado');
    } else if (webhookConfig.auth_token) {
      headers['x-webhook-secret'] = webhookConfig.auth_token;
      console.log('[Maps] Webhook secret configurado');
    }

    console.log('[Maps] Enviando requisição para n8n...');
    const response = await fetch(webhookConfig.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        startUrls: [{ url: startUrl }],
        company_id: companyId,
        quantity,
      }),
    });

    console.log('[Maps] Response status:', response.status);
    console.log('[Maps] Response OK:', response.ok);

    // Pegar o texto da resposta PRIMEIRO para debug
    const responseText = await response.text();
    console.log('[Maps] Response text (primeiros 500 chars):', responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`N8N request failed: ${response.statusText} - ${responseText}`);
    }

    // Tratar resposta vazia
    if (!responseText || responseText.trim() === '') {
      console.warn('[Maps] n8n retornou resposta vazia! Considerando sucesso.');
      return { success: true, message: 'Webhook executado (resposta vazia)', data: {} };
    }

    // Tentar parsear como JSON
    try {
      const result = JSON.parse(responseText);
      console.log('[Maps] Resultado parseado:', result);
      return result;
    } catch (parseError) {
      console.error('[Maps] ERRO ao parsear JSON:', parseError);
      throw new Error(`n8n retornou resposta inválida: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error('[Maps] ERRO na extração:', error);
    throw error;
  }
}

export async function extractICPLeads(
  companyId: number,
  icpId: number,
  icpConfig: any
): Promise<N8NResponse> {
  try {
    console.log('[ICP] Iniciando extração para company_id:', companyId, 'icp_id:', icpId);

    // Buscar configuração do webhook do banco de dados
    const supabase = await createClient();
    console.log('[ICP] Supabase client criado');

    const { data: webhookConfig, error: configError } = await supabase
      .from('n8n_webhook_config')
      .select('*')
      .eq('webhook_type', 'icp')
      .eq('is_active', true)
      .single();

    console.log('[ICP] Webhook config:', webhookConfig);
    console.log('[ICP] Config error:', configError);

    if (configError || !webhookConfig) {
      throw new Error('Webhook ICP não configurado. Configure em Admin > N8N.');
    }

    console.log('[ICP] Webhook URL:', webhookConfig.webhook_url);
    console.log('[ICP] Auth type:', webhookConfig.auth_type);

    // Criar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Adicionar Basic Auth se configurado
    if (webhookConfig.auth_type === 'basic' && webhookConfig.auth_username && webhookConfig.auth_password) {
      const basicAuth = Buffer.from(
        `${webhookConfig.auth_username}:${webhookConfig.auth_password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
      console.log('[ICP] Basic Auth configurado');
    }

    console.log('[ICP] Enviando requisição para n8n...');
    const response = await fetch(webhookConfig.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        company_id: companyId,
        icp_id: icpId,
        icp: {
          idade_min: icpConfig.idade_min,
          idade_max: icpConfig.idade_max,
          renda_min: icpConfig.renda_min,
          renda_max: icpConfig.renda_max,
          genero: icpConfig.genero,
          escolaridade: icpConfig.escolaridade,
          estados: icpConfig.estados,
          nichos: icpConfig.nichos,
          tamanho_empresas: icpConfig.tamanho_empresas,
          tempo_mercado: icpConfig.tempo_mercado,
          empresa_funcionarios: icpConfig.empresa_funcionarios,
          canais: icpConfig.canais,
          preferencia_contato: icpConfig.preferencia_contato,
          horario: icpConfig.horario,
          linguagem: icpConfig.linguagem,
          ciclo_compra: icpConfig.ciclo_compra,
          comprou_online: icpConfig.comprou_online,
          influenciador: icpConfig.influenciador,
          budget_min: icpConfig.budget_min,
          budget_max: icpConfig.budget_max,
          dores: icpConfig.dores,
          objetivos: icpConfig.objetivos,
          leads_por_dia_max: icpConfig.leads_por_dia_max,
          usar_ia: icpConfig.usar_ia,
          entregar_fins_semana: icpConfig.entregar_fins_semana,
          notificar_novos_leads: icpConfig.notificar_novos_leads,
          prioridade: icpConfig.prioridade,
        },
      }),
    });

    console.log('[ICP] Response status:', response.status);
    console.log('[ICP] Response OK:', response.ok);
    console.log('[ICP] Response headers:', Object.fromEntries(response.headers.entries()));

    // Pegar o texto da resposta PRIMEIRO para debug
    const responseText = await response.text();
    console.log('[ICP] Response text (primeiros 500 chars):', responseText.substring(0, 500));
    console.log('[ICP] Response text length:', responseText.length);

    if (!response.ok) {
      throw new Error(`N8N request failed: ${response.statusText} - ${responseText}`);
    }

    // Tentar parsear como JSON
    if (!responseText || responseText.trim() === '') {
      console.warn('[ICP] n8n retornou resposta vazia! Considerando sucesso.');
      return { success: true, message: 'Webhook executado (resposta vazia)', data: {} };
    }

    try {
      const result = JSON.parse(responseText);
      console.log('[ICP] Resultado parseado:', result);
      return result;
    } catch (parseError) {
      console.error('[ICP] ERRO ao parsear JSON:', parseError);
      console.error('[ICP] Texto completo da resposta:', responseText);
      throw new Error(`n8n retornou resposta inválida (não é JSON): ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error('[ICP] ERRO na extração:', error);
    throw error;
  }
}

export async function sendWhatsAppMessage(payload: {
  number: string;
  text: string;
  messageType?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  company_id: number;
  url_instancia: string; // URL base da instância UAZapi
  token: string; // Token de autenticação
  conversa_id: string;
  lead_id: string;
  message_id: string;
}): Promise<N8NResponse> {
  try {
    console.log('[WhatsApp] Enviando mensagem via n8n:', {
      number: payload.number,
      messageType: payload.messageType || 'text',
      url_instancia: payload.url_instancia,
    });

    // Buscar configuração do webhook do banco de dados
    const supabase = await createClient();

    const { data: webhookConfig, error: configError } = await supabase
      .from('n8n_webhook_config')
      .select('*')
      .eq('webhook_type', 'whatsapp')
      .eq('is_active', true)
      .single();

    console.log('[WhatsApp] Webhook config:', webhookConfig);
    console.log('[WhatsApp] Config error:', configError);

    if (configError || !webhookConfig) {
      console.error('[WhatsApp] ERRO: Webhook não configurado!', { configError, webhookConfig });
      throw new Error('Webhook WhatsApp não configurado. Configure em Admin > Webhooks & APIs.');
    }

    if (!webhookConfig.webhook_url) {
      console.error('[WhatsApp] ERRO: URL do webhook vazia!');
      throw new Error('URL do webhook WhatsApp não configurada');
    }

    console.log('[WhatsApp] ✓ Webhook config OK. URL:', webhookConfig.webhook_url);

    // Criar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Adicionar autenticação baseada no tipo
    if (webhookConfig.auth_type === 'basic' && webhookConfig.auth_username && webhookConfig.auth_password) {
      const basicAuth = Buffer.from(
        `${webhookConfig.auth_username}:${webhookConfig.auth_password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    } else if (webhookConfig.auth_type === 'bearer' && webhookConfig.auth_token) {
      headers['Authorization'] = `Bearer ${webhookConfig.auth_token}`;
    } else if (webhookConfig.auth_token) {
      headers['x-webhook-secret'] = webhookConfig.auth_token;
    }

    const response = await fetch(webhookConfig.webhook_url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    console.log('[WhatsApp] Response status:', response.status);
    console.log('[WhatsApp] Response OK:', response.ok);

    // Pegar texto da resposta PRIMEIRO para debug
    const responseText = await response.text();
    console.log('[WhatsApp] Response text:', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('[WhatsApp] ERRO NA RESPOSTA:', {
        status: response.status,
        statusText: response.statusText,
        url: webhookConfig.webhook_url,
        responsePreview: responseText.substring(0, 500)
      });

      if (response.status === 404) {
        throw new Error(
          `Webhook não encontrado no n8n (404). ` +
          `Verifique se o workflow está ATIVO em modo PRODUÇÃO. ` +
          `URL: ${webhookConfig.webhook_url}`
        );
      }

      throw new Error(`N8N request failed (${response.status}): ${response.statusText} - ${responseText}`);
    }

    // Tratar resposta vazia
    if (!responseText || responseText.trim() === '') {
      console.warn('[WhatsApp] n8n retornou resposta vazia! Considerando sucesso.');
      return { success: true, message: 'Mensagem enviada (webhook executado)' };
    }

    // Tentar parsear como JSON
    try {
      const result = JSON.parse(responseText);
      console.log('[WhatsApp] Resultado parseado:', result);
      return result;
    } catch (parseError) {
      console.error('[WhatsApp] ERRO ao parsear JSON:', parseError);
      console.error('[WhatsApp] Resposta completa:', responseText);
      throw new Error(`n8n retornou resposta inválida: ${responseText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error('Error calling n8n WhatsApp send:', error);
    throw error;
  }
}
