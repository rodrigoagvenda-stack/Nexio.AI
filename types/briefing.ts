export interface BriefingResponse {
  id: number;
  nome_responsavel: string;
  email: string;
  whatsapp: string;
  country_code: string;
  nome_empresa: string;
  site?: string;
  instagram?: string;
  segmento: string;
  tempo_mercado: string;
  investe_marketing: 'sim' | 'nao';
  resultados?: string;
  objetivo?: string;
  faturamento: string;
  budget: string;
  submitted_at: string;
  webhook_sent: boolean;
  webhook_sent_at?: string;
  created_at: string;
}

export interface BriefingConfig {
  id: number;
  webhook_url?: string;
  webhook_secret?: string;
  is_active: boolean;
  last_test_at?: string;
  last_test_status?: 'success' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface BriefingFormData {
  nome_responsavel: string;
  email: string;
  whatsapp: string;
  country_code: string;
  nome_empresa: string;
  site?: string;
  instagram?: string;
  segmento: string;
  tempo_mercado: string;
  investe_marketing: 'sim' | 'nao';
  resultados?: string;
  objetivo?: string;
  faturamento: string;
  budget: string;
}
