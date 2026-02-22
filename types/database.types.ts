export interface Company {
  id: number;
  name: string;
  email: string;
  phone?: string;
  image_url?: string;
  plan_type: 'basic' | 'performance' | 'advanced' | 'crm-smart';
  plan_name?: 'NEXIO SALES' | 'NEXIO GROWTH' | 'NEXIO ADS';
  plan_price?: number;
  plan_features?: any[];
  vendagro_plan?: 'performance' | 'advanced' | null;
  plan_id?: number | null;
  plan_monthly_limit?: number;
  leads_extracted_this_month?: number;
  last_extraction_month?: string;
  whatsapp_instance?: string;
  whatsapp_token?: string;
  webhook_maps_url?: string;
  webhook_maps_enabled?: boolean;
  webhook_whatsapp_url?: string;
  webhook_whatsapp_enabled?: boolean;
  is_active: boolean;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  auth_user_id: string;
  user_id: string;
  company_id: number;
  name: string;
  email: string;
  photo_url?: string;
  description?: string;
  department?: string;
  role?: 'admin' | 'manager' | 'member';
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// ENUMs do banco de dados
export type Segmento =
  | 'E-commerce'
  | 'Saúde/Medicina'
  | 'Educação'
  | 'Alimentação'
  | 'Beleza/Estética'
  | 'Imobiliária'
  | 'Advocacia'
  | 'Consultoria'
  | 'Tecnologia'
  | 'Moda/Fashion'
  | 'Arquitetura'
  | 'Outros';

export type Prioridade = 'Alta' | 'Média' | 'Baixa';

export type FonteImportacao =
  | 'PEG'
  | 'Linkedin'
  | 'Interno'
  | 'Meta Ads'
  | 'Google Ads'
  | 'Site/Landing Page'
  | 'Indicação'
  | 'WhatsApp'
  | 'TikTok Ads'
  | 'E-mail Marketing'
  | 'Evento/Feira';

export type EstagioLead =
  | 'Lead novo'
  | 'Em contato'
  | 'Interessado'
  | 'Proposta enviada'
  | 'Fechado'
  | 'Perdido'
  | 'Remarketing';

export type StatusLead = 'Quente 🔥' | 'Morno 🌡️' | 'Frio ❄️';

export type Cargo =
  | 'Proprietário/Dono'
  | 'Gerente Comercial'
  | 'Vendedor'
  | 'Representante Comercial'
  | 'Consultor de Vendas';

export interface Lead {
  id: number;
  lead_id: string;
  company_id: number;
  user_id?: string;
  company_name: string;
  contact_name?: string;
  segment?: Segmento;
  website_or_instagram?: string;
  whatsapp?: string;
  email?: string;
  priority: Prioridade;
  status: EstagioLead;
  nivel_interesse: StatusLead;
  import_source?: FonteImportacao;
  cargo?: Cargo;
  project_value?: number;
  notes?: string;
  resumo_ia?: string;
  created_at: string;
  updated_at: string;
}

export interface ICPConfiguration {
  id: number;
  company_id: number;
  idade_min?: number;
  idade_max?: number;
  renda_min?: number;
  renda_max?: number;
  genero?: string;
  escolaridade?: string;
  estados?: string[];
  regioes?: string[];
  nichos?: string[];
  tamanho_empresa?: string;
  tempo_mercado?: string;
  empresa_funcionarios?: string;
  canais?: string[];
  preferencia_contato?: string;
  horario?: string;
  linguagem?: string;
  ciclo_compra?: string;
  comprou_online?: boolean;
  influenciador?: boolean;
  budget_min?: number;
  budget_max?: number;
  dores?: string;
  objetivos?: string;
  leads_por_dia_max?: number;
  usar_ia?: boolean;
  entregar_fins_semana?: boolean;
  notificar_novos_leads?: boolean;
  prioridade?: string;
  created_at: string;
  updated_at: string;
}

export interface ICPLead {
  id: number;
  company_id: number;
  icp_id?: number;
  source_lead_id?: number;
  nome?: string;
  empresa?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  segmento?: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  company_id: number;
  id_do_lead?: number;
  numero_de_telefone: string;
  nome_do_contato?: string;
  ultima_mensagem?: string;
  hora_da_ultima_mensagem?: string;
  contagem_nao_lida?: number;
  status_da_conversa: 'aberto' | 'fechado';
  agente_atribuido?: string;
  etiquetas?: string[];
  criado_em: string;
  atualizado_em: string;
}

export interface Message {
  id: number;
  company_id: number;
  id_da_conversacao: number;
  id_do_lead?: number;
  texto_da_mensagem?: string;
  tipo_de_mensagem: 'text' | 'image' | 'audio';
  direcao: 'inbound' | 'outbound';
  sender_type: 'ai' | 'human';
  sender_user_id?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadados?: any;
  carimbo_de_data_e_hora?: string;
  criado_em: string;
}

export interface SystemLog {
  id: number;
  type: 'webhook' | 'error' | 'user_action';
  severity: 'info' | 'warning' | 'error' | 'critical';
  company_id?: number;
  user_id?: string;
  message: string;
  payload?: any;
  stack_trace?: string;
  created_at: string;
}

export interface ChatNote {
  id: number;
  company_id: number;
  lead_id?: number;
  conversation_id?: number;
  user_id: string;
  note_text: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface Tag {
  id: number;
  company_id: number;
  tag_name: string;
  tag_color: string;
  created_at: string;
}

export interface LeadTag {
  id: number;
  lead_id: number;
  tag_id: number;
  created_at: string;
  tag?: Tag;
}

export interface AdminUser {
  id: number;
  user_id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'support';
  is_active: boolean;
  last_login?: string;
  created_at: string;
}
