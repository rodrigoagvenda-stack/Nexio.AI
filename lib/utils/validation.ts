import { z } from 'zod';

// Lead validation
export const leadSchema = z.object({
  company_name: z.string().min(1, 'Nome da empresa é obrigatório'),
  contact_name: z.string().optional(),
  segment: z.string().optional(),
  website_or_instagram: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  priority: z.enum(['Alta', 'Média', 'Baixa']).default('Média'),
  status: z.enum(['Lead novo', 'Em contato', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido']).default('Lead novo'),
  nivel_interesse: z.enum(['Quente 🔥', 'Morno 🌡️', 'Frio ❄️']).default('Morno 🌡️'),
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
