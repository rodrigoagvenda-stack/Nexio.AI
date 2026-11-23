import { timingSafeEqual } from 'crypto'

/**
 * Chamada servidor a servidor do Cockpit (atendimento com a marca do Cockpit, motor do Zaapply).
 * O Cockpit manda a service key do banco do Zaapply em x-cockpit-key e a empresa em x-company-id.
 * Devolve o company_id quando a chave confere; null em qualquer outro caso (segue o login normal).
 */
export function cockpitCompanyId(req: Request): number | null {
  const got = req.headers.get('x-cockpit-key') ?? ''
  const want = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!got || !want || got.length !== want.length) return null
  if (!timingSafeEqual(Buffer.from(got), Buffer.from(want))) return null
  const id = Number(req.headers.get('x-company-id'))
  return Number.isFinite(id) && id > 0 ? id : null
}
