/**
 * Platform-level configuration stored in the `platform_config` table.
 * Sensitive values are encrypted at rest using lib/crypto.
 * Falls back to process.env if not set in DB.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { encrypt, decrypt } from '@/lib/crypto';

export const SENSITIVE_KEYS = new Set([
  'uazapi_admin_token',
  'google_client_secret',
  'stripe_secret_key',
  'stripe_webhook_secret',
  'openai_api_key',
  'asaas_api_key',
  'asaas_webhook_token',
  'groq_api_key',
  'apify_api_token',
  'google_places_api_key',
]);

const MASK = '••••••••••••••••';

export interface PlatformConfig {
  uazapi_base_url: string;
  uazapi_admin_token: string;
  openai_api_key: string;
  google_client_id: string;
  google_client_secret: string;
  stripe_secret_key: string;
  stripe_webhook_secret: string;
  stripe_price_starter: string;
  stripe_price_pro: string;
  stripe_price_scale: string;
  asaas_api_key: string;
  asaas_base_url: string;
  asaas_webhook_token: string;
  groq_api_key: string;
  apify_api_token: string;
  google_places_api_key: string;
}

/** Read all platform config keys from DB, decrypt sensitive ones. Falls back to env. */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  try {
    const supabase = createServiceClient();
    const { data: rows } = await supabase
      .from('platform_config')
      .select('key, value, is_encrypted');

    const map: Record<string, string> = {};
    for (const row of rows ?? []) {
      try {
        map[row.key] = row.is_encrypted ? decrypt(row.value) : row.value;
      } catch {
        // decryption failure → skip
      }
    }

    return {
      uazapi_base_url: map.uazapi_base_url || process.env.UAZAPI_BASE_URL || '',
      uazapi_admin_token: map.uazapi_admin_token || process.env.UAZAPI_ADMIN_TOKEN || '',
      openai_api_key: map.openai_api_key || process.env.OPENAI_API_KEY || '',
      google_client_id: map.google_client_id || process.env.GOOGLE_CLIENT_ID || '',
      google_client_secret: map.google_client_secret || process.env.GOOGLE_CLIENT_SECRET || '',
      stripe_secret_key: map.stripe_secret_key || process.env.STRIPE_SECRET_KEY || '',
      stripe_webhook_secret: map.stripe_webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || '',
      stripe_price_starter: map.stripe_price_starter || process.env.STRIPE_PRICE_STARTER || '',
      stripe_price_pro: map.stripe_price_pro || process.env.STRIPE_PRICE_PRO || '',
      stripe_price_scale: map.stripe_price_scale || process.env.STRIPE_PRICE_SCALE || '',
      asaas_api_key: map.asaas_api_key || process.env.ASAAS_API_KEY || '',
      asaas_base_url: map.asaas_base_url || process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3',
      asaas_webhook_token: map.asaas_webhook_token || process.env.ASAAS_WEBHOOK_TOKEN || '',
      groq_api_key: map.groq_api_key || process.env.GROQ_API_KEY || '',
      apify_api_token: map.apify_api_token || process.env.APIFY_API_TOKEN || '',
      google_places_api_key: map.google_places_api_key || process.env.GOOGLE_PLACES_API_KEY || '',
    };
  } catch {
    // DB unavailable → env only
    return {
      uazapi_base_url: process.env.UAZAPI_BASE_URL || '',
      uazapi_admin_token: process.env.UAZAPI_ADMIN_TOKEN || '',
      openai_api_key: process.env.OPENAI_API_KEY || '',
      google_client_id: process.env.GOOGLE_CLIENT_ID || '',
      google_client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      stripe_secret_key: process.env.STRIPE_SECRET_KEY || '',
      stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || '',
      stripe_price_starter: process.env.STRIPE_PRICE_STARTER || '',
      stripe_price_pro: process.env.STRIPE_PRICE_PRO || '',
      stripe_price_scale: process.env.STRIPE_PRICE_SCALE || '',
      asaas_api_key: process.env.ASAAS_API_KEY || '',
      asaas_base_url: process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3',
      asaas_webhook_token: process.env.ASAAS_WEBHOOK_TOKEN || '',
      groq_api_key: process.env.GROQ_API_KEY || '',
      apify_api_token: process.env.APIFY_API_TOKEN || '',
      google_places_api_key: process.env.GOOGLE_PLACES_API_KEY || '',
    };
  }
}

/** Read raw rows for admin UI display (sensitive values masked). */
export async function getPlatformConfigForAdmin(): Promise<Record<string, string>> {
  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from('platform_config')
    .select('key, value, is_encrypted');

  if (error) throw new Error(error.message);

  const result: Record<string, string> = {};
  for (const row of rows ?? []) {
    result[row.key] = row.is_encrypted ? MASK : row.value;
  }
  return result;
}

/** Upsert a single key. Encrypts sensitive values automatically. */
export async function setPlatformConfigKey(key: string, value: string): Promise<void> {
  const supabase = createServiceClient();
  const sensitive = SENSITIVE_KEYS.has(key);

  const { error } = await supabase.from('platform_config').upsert(
    {
      key,
      value: sensitive ? encrypt(value) : value,
      is_encrypted: sensitive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );

  if (error) throw new Error(error.message);
}
