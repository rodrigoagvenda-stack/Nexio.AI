/**
 * UAZapi Admin Client : operações administrativas (criar/deletar instâncias).
 * Lê credenciais de platform_config (DB) com fallback para env vars.
 */

import { getPlatformConfig } from '@/lib/platform-config';

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const cfg = await getPlatformConfig();
  const baseUrl = (cfg.uazapi_base_url || 'https://nexioai.uazapi.com').replace(/\/$/, '');
  const adminToken = cfg.uazapi_admin_token;

  if (!adminToken) {
    throw new Error('UAZAPI_ADMIN_TOKEN não configurado. Configure em Admin → Configurações → UAZapi.');
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'admintoken': adminToken,
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

export async function createInstance(params: {
  name: string;
  companyId: number;
}): Promise<CreatedInstance> {
  const data = await adminRequest<any>('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      name: params.name,
      systemName: 'zaapply',
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

export async function listInstances(): Promise<any[]> {
  return adminRequest<any[]>('/instance/all');
}

export async function deleteInstance(instanceToken: string): Promise<void> {
  const cfg = await getPlatformConfig();
  const baseUrl = (cfg.uazapi_base_url || 'https://nexioai.uazapi.com').replace(/\/$/, '');
  await fetch(`${baseUrl}/instance`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'token': instanceToken },
  });
}

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
