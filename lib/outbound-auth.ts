import { createClient } from '@/lib/supabase/server'

const WRITE_ROLES = ['admin', 'company_admin', 'manager']

export interface OutboundCaller {
  companyId: number
  role: string
}

export interface OutboundAuthError {
  message: string
  status: number
}

/**
 * Resolve a empresa do usuário autenticado pra rotas de `/api/outbound/*`.
 * `company_id` nunca vem do client (body/query) : sempre do usuário logado,
 * mesmo padrão já usado em `/api/outbound/limits`.
 */
export async function resolveOutboundCaller(requireWriteRole = false): Promise<OutboundCaller | OutboundAuthError> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { message: 'Não autorizado', status: 401 }

  const { data: userData } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('auth_user_id', user.id)
    .single()

  if (!userData?.company_id) return { message: 'Empresa não encontrada', status: 403 }

  if (requireWriteRole && !WRITE_ROLES.includes(userData.role ?? '')) {
    return { message: 'Apenas administradores podem alterar esses dados', status: 403 }
  }

  return { companyId: userData.company_id, role: userData.role ?? '' }
}

export function isOutboundAuthError(v: OutboundCaller | OutboundAuthError): v is OutboundAuthError {
  return 'status' in v
}
