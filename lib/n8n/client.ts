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

export async function extractICPLeads(companyId: number): Promise<N8NResponse> {
  try {
    const response = await fetch(N8N_WEBHOOK_ICP, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        company_id: companyId,
      }),
    });

    if (!response.ok) {
      throw new Error(`N8N request failed: ${response.statusText}`);
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
