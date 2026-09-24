// Papéis que podem ser atribuídos a um membro e quais deles têm poder de administrador.
export const MEMBER_ROLES = ['admin', 'manager', 'sdr', 'closer', 'sdr_closer', 'company_admin', 'company_user'] as const

export const PRIVILEGED_ROLES = ['admin', 'company_admin'] as const

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return !!role && (PRIVILEGED_ROLES as readonly string[]).includes(role)
}

export function isValidMemberRole(role: unknown): role is (typeof MEMBER_ROLES)[number] {
  return typeof role === 'string' && (MEMBER_ROLES as readonly string[]).includes(role)
}
