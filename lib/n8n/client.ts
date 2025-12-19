const N8N_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL!;
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
    const response = await fetch(`${N8N_BASE_URL}/webhook/extrair-leads`, {
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
    const response = await fetch(`${N8N_BASE_URL}/webhook/extrair-icp-leads`, {
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
    const response = await fetch(`${N8N_BASE_URL}/webhook/send-manual-message`, {
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
