const N8N_WEBHOOK_MAPS = process.env.N8N_WEBHOOK_MAPS!;
const N8N_WEBHOOK_ICP = process.env.N8N_WEBHOOK_ICP!;
const N8N_WEBHOOK_WHATSAPP = process.env.N8N_WEBHOOK_WHATSAPP!;
const WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET!;

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
    const response = await fetch(N8N_WEBHOOK_MAPS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        startUrls: [{ url: startUrl }],
        company_id: companyId,
        quantity,
      }),
    });

    if (!response.ok) {
      throw new Error(`N8N request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling n8n Maps extraction:', error);
    throw error;
  }
}

export async function extractICPLeads(
  companyId: number,
  icpConfig: any
): Promise<N8NResponse> {
  try {
    // Criar credenciais Basic Auth
    const username = 'Boladao';
    const password = 'Bruniboladao';
    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

    const response = await fetch(N8N_WEBHOOK_ICP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        company_id: companyId,
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`N8N request failed: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling n8n ICP extraction:', error);
    throw error;
  }
}

export async function sendWhatsAppMessage(payload: {
  number: string;
  text: string;
  company_id: number;
  instance_name: string;
  instance_token: string;
  conversa_id: string;
  lead_id: string;
  message_id: string;
}): Promise<N8NResponse> {
  try {
    const response = await fetch(N8N_WEBHOOK_WHATSAPP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`N8N request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling n8n WhatsApp send:', error);
    throw error;
  }
}
