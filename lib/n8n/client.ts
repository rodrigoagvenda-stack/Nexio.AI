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

export async function extractICPLeads(
  companyId: number,
  icpId: number,
  icpConfig: any
): Promise<N8NResponse> {
  try {
    console.log('[ICP] Iniciando extração para company_id:', companyId, 'icp_id:', icpId);

    // Buscar configuração do webhook do banco de dados
    const supabase = await createClient();

    const { data: webhookConfig, error: configError } = await supabase
      .from('n8n_webhook_config')
      .select('*')
      .eq('webhook_type', 'icp')
      .eq('is_active', true)
      .single();

    if (configError || !webhookConfig) {
      throw new Error('Webhook ICP não configurado. Configure em Admin > N8N.');
    }

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
    }

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

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[ICP] N8N request failed (${response.status}):`, responseText.substring(0, 500));
      if (response.status === 404) {
        throw new Error('Workflow ICP não encontrado no n8n. Verifique se o workflow está ativo em modo Produção.');
      }
      throw new Error(`Falha ao acionar automação ICP (status ${response.status}). Verifique o workflow no n8n.`);
    }

    if (!responseText || responseText.trim() === '') {
      console.warn('[ICP] n8n retornou resposta vazia! Considerando sucesso.');
      return { success: true, message: 'Webhook executado (resposta vazia)', data: {} };
    }

    try {
      const result = JSON.parse(responseText);
      return result;
    } catch (parseError) {
      console.error('[ICP] ERRO ao parsear JSON:', parseError, responseText.substring(0, 200));
      throw new Error('Automação ICP retornou resposta inválida. Verifique o workflow no n8n.');
    }
  } catch (error) {
    console.error('[ICP] ERRO na extração:', error);
    throw error;
  }
}

export async function sendWhatsAppMessage(
  payload: {
    number: string;
    text: string;
    messageType?: string;
    mediaUrl?: string;
    caption?: string;
    filename?: string;
    company_id: number;
    url_instancia: string;
    token: string;
    conversa_id: string;
    lead_id: string;
    message_id: string;
  },
  webhookConfig?: {
    webhook_url: string;
    auth_type?: string;
    auth_username?: string;
    auth_password?: string;
    auth_token?: string;
  }
): Promise<N8NResponse> {
  try {
    // Se a config não foi passada, buscar webhook_whatsapp_url da empresa
    if (!webhookConfig) {
      const supabase = await createClient();
      const { data: companyData, error } = await supabase
        .from('companies')
        .select('webhook_whatsapp_url, webhook_whatsapp_enabled')
        .eq('id', payload.company_id)
        .single();

      if (error || !companyData?.webhook_whatsapp_url) {
        throw new Error('Webhook WhatsApp não configurado para esta empresa. Configure em Admin > Empresas.');
      }
      if (!companyData.webhook_whatsapp_enabled) {
        throw new Error('Webhook WhatsApp está desativado para esta empresa. Ative em Admin > Empresas.');
      }
      webhookConfig = { webhook_url: companyData.webhook_whatsapp_url };
    }

    // Criar headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

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

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[WhatsApp] N8N request failed (${response.status}):`, responseText.substring(0, 500));
      if (response.status === 404) {
        throw new Error('Workflow WhatsApp não encontrado no n8n. Verifique se o workflow está ativo em modo Produção.');
      }
      throw new Error(`Falha ao enviar mensagem via automação (status ${response.status}). Verifique o workflow no n8n.`);
    }

    const responseText = await response.text();

    if (!responseText || responseText.trim() === '') {
      return { success: true, message: 'Mensagem enviada (webhook executado)' };
    }

    try {
      return JSON.parse(responseText);
    } catch {
      console.error('[WhatsApp] Resposta inválida do n8n:', responseText.substring(0, 200));
      throw new Error('Automação WhatsApp retornou resposta inválida. Verifique o workflow no n8n.');
    }
  } catch (error) {
    console.error('Error calling n8n WhatsApp send:', error);
    throw error;
  }
}
