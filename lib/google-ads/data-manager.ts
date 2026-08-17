// Upload de Enhanced Conversions for Leads via Google Ads Data Manager API.
//
// TODO: a Data Manager API é nova (Google Ads API foi bloqueada pra esse uso
// a partir de 15/jun/2026) e o formato exato do request não foi verificado
// contra a documentação oficial ainda — implementar de verdade só depois de
// (1) o Developer Token estar aprovado numa conta gerenciadora (MCC) e
// (2) confirmar o shape do payload na doc ao vivo. Não adivinhar o formato.
//
// Referência de partida: https://support.google.com/google-ads/answer/15713840

import { safeDecrypt } from '@/lib/crypto';

export interface GoogleAdsIntegration {
  access_token: string | null;
  refresh_token: string;
  customer_id: string | null;
  login_customer_id: string | null;
  developer_token: string | null;
  conversion_action_id: string | null;
}

export interface UploadEnhancedConversionParams {
  integration: GoogleAdsIntegration;
  phone: string;
  email?: string | null;
  gclid?: string | null;
  conversionDateTime: string; // ISO 8601
  valueCents?: number | null;
  currency?: string;
}

export interface UploadEnhancedConversionResult {
  ok: boolean;
  skipped?: string;
  error?: string;
}

export async function uploadEnhancedConversion(
  params: UploadEnhancedConversionParams
): Promise<UploadEnhancedConversionResult> {
  const { integration } = params;

  if (!integration.developer_token || !integration.customer_id || !integration.conversion_action_id) {
    return { ok: false, skipped: 'integration_not_fully_configured' };
  }

  const refreshToken = safeDecrypt(integration.refresh_token);
  void refreshToken;

  // TODO: implementar a chamada real à Data Manager API aqui.
  return { ok: false, error: 'not_implemented' };
}
