/**
 * platform-config.ts
 * Centraliza configurações da plataforma via variáveis de ambiente.
 */

export interface PlatformConfig {
  asaas_webhook_token: string
  asaas_api_key: string
  asaas_env: 'sandbox' | 'production'
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  return {
    asaas_webhook_token: process.env.ASAAS_WEBHOOK_TOKEN ?? '',
    asaas_api_key:       process.env.ASAAS_API_KEY ?? '',
    asaas_env:           (process.env.ASAAS_ENV as 'sandbox' | 'production') ?? 'sandbox',
  }
}
