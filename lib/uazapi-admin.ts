/**
 * UAZapi Admin Client — operações administrativas (criar/deletar instâncias)
 * Usa UAZAPI_ADMIN_TOKEN e UAZAPI_BASE_URL do ambiente
 */

const BASE_URL = (process.env.UAZAPI_BASE_URL || 'https://nexioai.uazapi.com').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN!;

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'admintoken': ADMIN_TOKEN,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UAZapi Admin error ${res.status}: ${text}`);
  }

  return res.json();
}

export interface CreatedInstance {
  token: string;
  name: string;
  id: string;
  status: string;
  qrcode?: string;
  paircode?: string;
}

/** Cria nova instância UAZapi para uma empresa */
export async function createInstance(params: {
  name: string;
  companyId: number;
}): Promise<CreatedInstance> {
  const data = await adminRequest<any>('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      systemName: 'zaapli',
      adminField01: String(params.companyId),
    }),
  });
  return {
    token: data.token,
    name: data.name,
    id: data.instance?.id || data.id,
    status: data.instance?.status || 'disconnected',
    qrcode: data.instance?.qrcode,
    paircode: data.instance?.paircode,
  };
}

/** Lista todas as instâncias */
export async function listInstances(): Promise<any[]> {
  return adminRequest<any[]>('/instance/all');
}

/** Deleta uma instância pelo token dela */
export async function deleteInstance(instanceToken: string): Promise<void> {
  await fetch(`${BASE_URL}/instance`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'token': instanceToken },
  });
}

/** Configura webhook global para receber todas as mensagens */
export async function setGlobalWebhook(webhookUrl: string): Promise<void> {
  await adminRequest('/globalwebhook', {
    method: 'POST',
    body: JSON.stringify({
      url: webhookUrl,
      events: ['messages', 'connection'],
      excludeMessages: ['wasSentByApi'],
    }),
  });
}
