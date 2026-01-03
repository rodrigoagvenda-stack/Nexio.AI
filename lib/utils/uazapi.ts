import { createClient } from '@/lib/supabase/server';

export interface UAZapiConfig {
  instance: string;
  token: string;
}

/**
 * Get UAZapi credentials for a company
 */
export async function getUAZapiConfig(companyId: number): Promise<UAZapiConfig | null> {
  const supabase = await createClient();

  const { data: company } = await supabase
    .from('companies')
    .select('whatsapp_instance, whatsapp_token')
    .eq('id', companyId)
    .single();

  if (!company || !company.whatsapp_instance || !company.whatsapp_token) {
    return null;
  }

  return {
    instance: company.whatsapp_instance,
    token: company.whatsapp_token,
  };
}

/**
 * Make a request to UAZapi
 */
export async function uazapiRequest(
  config: UAZapiConfig,
  endpoint: string,
  method: string = 'POST',
  body?: any
): Promise<any> {
  const url = `${config.instance}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'apikey': config.token,
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`UAZapi request failed: ${response.statusText}`);
  }

  return await response.json();
}
