import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getActiveConfig, listConfigVersions, saveConfigVersion } from '@/lib/sdr/v3/config-store'
import { validateCompanyConfig } from '@/lib/sdr/v3/config-validate'

export const runtime = 'nodejs'

const CAN_EDIT = new Set(['admin', 'manager', 'company_admin'])

// GET /api/sdr/v3/config : config ativa da empresa e o histórico de versões.
export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error
  const [ativa, versoes] = await Promise.all([getActiveConfig(context.companyId), listConfigVersions(context.companyId)])
  return NextResponse.json({ success: true, data: { ativa, versoes } })
}

// PUT /api/sdr/v3/config : valida e salva uma nova versão. Body: { config, nota?, activate?, apenasValidar? }
// Erros bloqueiam o salvamento; avisos são devolvidos junto.
export async function PUT(request: NextRequest) {
  const { context, error } = await requireAuth(request)
  if (error) return error
  if (!CAN_EDIT.has(context.role)) {
    return NextResponse.json({ success: false, message: 'Sem permissão para alterar a configuração do SDR.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  if (!body.config) return NextResponse.json({ success: false, message: 'Envie a configuração.' }, { status: 400 })

  if (body.apenasValidar === true) {
    const v = validateCompanyConfig({ ...body.config, version: body.config.version ?? 1 })
    return NextResponse.json({ success: v.erros.length === 0, erros: v.erros, avisos: v.avisos })
  }

  const result = await saveConfigVersion(context.companyId, body.config, {
    nota: typeof body.nota === 'string' ? body.nota : undefined,
    createdBy: String(context.userId ?? ''),
    activate: body.activate !== false,
  })
  if (!result.ok) return NextResponse.json({ success: false, message: result.erros[0], erros: result.erros, avisos: result.avisos }, { status: 400 })
  return NextResponse.json({ success: true, version: result.version, avisos: result.avisos })
}
