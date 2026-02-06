export interface LeadQualificationResponse {
  id: number;
  // Informações Básicas
  nome_completo: string;
  whatsapp: string;
  country_code: string;
  email: string;
  nome_empresa: string;

  // Qualificação do Negócio
  segmento_negocio: string;
  volume_atendimentos: 'menos_20' | '20_50' | '50_100' | 'mais_100';

  // Identificação do Gargalo
  principal_gargalo: 'demora_resposta' | 'perda_leads' | 'equipe_sobrecarregada' | 'falta_organizacao' | 'dificuldade_qualificar' | 'nao_acompanha_funil' | 'outro';
  dor_principal?: string;

  // Maturidade Comercial
  processo_vendas: 'sim_estruturado' | 'sim_informal' | 'nao';
  ticket_medio?: string;
  pessoas_comercial?: string;

  // Urgência e Budget
  urgencia: 'urgente' | 'curto_prazo' | 'pesquisando';
  budget: '3000_5000' | '5000_8000' | 'acima_8000' | 'preciso_entender_roi';

  // Meta
  submitted_at: string;
  webhook_sent: boolean;
  webhook_sent_at?: string;
  created_at: string;
}

export interface LeadQualificationConfig {
  id: number;
  webhook_url?: string;
  webhook_secret?: string;
  is_active: boolean;
  last_test_at?: string;
  last_test_status?: 'success' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface LeadQualificationFormData {
  // Informações Básicas
  nome_completo: string;
  whatsapp: string;
  country_code: string;
  email: string;
  nome_empresa: string;

  // Qualificação do Negócio
  segmento_negocio: string;
  volume_atendimentos: string;

  // Identificação do Gargalo
  principal_gargalo: string;
  dor_principal?: string;

  // Maturidade Comercial
  processo_vendas: string;
  ticket_medio?: string;
  pessoas_comercial?: string;

  // Urgência e Budget
  urgencia: string;
  budget: string;
}

// Labels para os campos
export const VOLUME_ATENDIMENTOS_OPTIONS = [
  { value: 'menos_20', label: 'Menos de 20' },
  { value: '20_50', label: '20 a 50' },
  { value: '50_100', label: '50 a 100' },
  { value: 'mais_100', label: 'Mais de 100' },
];

export const GARGALO_OPTIONS = [
  { value: 'demora_resposta', label: 'Demora no tempo de resposta' },
  { value: 'perda_leads', label: 'Perda de leads fora do horário comercial' },
  { value: 'equipe_sobrecarregada', label: 'Equipe sobrecarregada' },
  { value: 'falta_organizacao', label: 'Falta de organização/informações perdidas' },
  { value: 'dificuldade_qualificar', label: 'Dificuldade em qualificar leads' },
  { value: 'nao_acompanha_funil', label: 'Não consigo acompanhar o funil de vendas' },
  { value: 'outro', label: 'Outro' },
];

export const PROCESSO_VENDAS_OPTIONS = [
  { value: 'sim_estruturado', label: 'Sim, temos funil e CRM' },
  { value: 'sim_informal', label: 'Sim, mas é informal/desorganizado' },
  { value: 'nao', label: 'Não, fazemos na "raça"' },
];

export const URGENCIA_OPTIONS = [
  { value: 'urgente', label: 'Urgente (este mês)' },
  { value: 'curto_prazo', label: 'Curto prazo (1-3 meses)' },
  { value: 'pesquisando', label: 'Estou pesquisando ainda' },
];

export const BUDGET_OPTIONS = [
  { value: '3000_5000', label: 'Entre R$ 3.000 e R$ 5.000/mês' },
  { value: '5000_8000', label: 'Entre R$ 5.000 e R$ 8.000/mês' },
  { value: 'acima_8000', label: 'Acima de R$ 8.000/mês' },
  { value: 'preciso_entender_roi', label: 'Preciso entender o ROI antes de definir' },
];

export const SEGMENTO_OPTIONS = [
  'Clínica',
  'Estética',
  'Imobiliária',
  'Escola',
  'Prestador de serviço',
  'Agência',
  'B2B',
  'E-commerce',
  'Consultoria',
  'Advocacia',
  'Contabilidade',
  'Saúde',
  'Tecnologia',
  'Outro',
];
