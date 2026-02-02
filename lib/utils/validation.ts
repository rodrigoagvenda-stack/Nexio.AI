import { z } from 'zod';

// ENUMs para validação
export const SegmentoEnum = z.enum([
  'E-commerce',
  'Saúde/Medicina',
  'Educação',
  'Alimentação',
  'Beleza/Estética',
  'Imobiliária',
  'Advocacia',
  'Consultoria',
  'Tecnologia',
  'Moda/Fashion',
  'Arquitetura',
  'Outros',
]);

export const FonteImportacaoEnum = z.enum([
  'PEG',
  'Linkedin',
  'Interno',
  'Meta Ads',
  'Google Ads',
  'Site/Landing Page',
  'Indicação',
  'WhatsApp',
  'TikTok Ads',
  'E-mail Marketing',
  'Evento/Feira',
]);

export const EstagioLeadEnum = z.enum([
  'Lead novo',
  'Em contato',
  'Interessado',
  'Proposta enviada',
  'Fechado',
  'Perdido',
  'Remarketing',
]);

export const StatusLeadEnum = z.enum(['Quente 🔥', 'Morno 🟠', 'Frio ❄️']);

export const CargoEnum = z.enum([
  'Proprietário/Dono',
  'Gerente Comercial',
  'Vendedor',
  'Representante Comercial',
  'Consultor de Vendas',
]);

export const PrioridadeEnum = z.enum(['Alta', 'Média', 'Baixa']);

// Lead validation
export const leadSchema = z.object({
  company_name: z.string().min(1, 'Nome da empresa é obrigatório'),
  contact_name: z.string().optional(),
  segment: SegmentoEnum,
  website_or_instagram: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  priority: PrioridadeEnum.default('Média'),
  status: EstagioLeadEnum.default('Lead novo'),
  nivel_interesse: StatusLeadEnum.default('Quente 🔥'),
  import_source: FonteImportacaoEnum.default('Interno'),
  cargo: CargoEnum,
  project_value: z.number().optional(),
  notes: z.string().optional(),
});

export type LeadFormData = z.infer<typeof leadSchema>;

// User profile validation
export const profileSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  description: z.string().optional(),
  department: z.string().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// Password validation
export const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  newPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export type PasswordFormData = z.infer<typeof passwordSchema>;

// Login validation
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Company validation
export const companySchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  plan_type: z.enum(['basic', 'performance', 'advanced']),
  vendagro_plan: z.enum(['performance', 'advanced']).nullable().optional(),
  plan_monthly_limit: z.number().int().positive().optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;
