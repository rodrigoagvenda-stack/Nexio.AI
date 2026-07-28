import { NextRequest, NextResponse } from 'next/server'
import { getUazapiForCompany } from '@/lib/sdr/uazapi-for-company'
import { requireAuth } from '@/lib/auth/require-auth'

export async function POST(req: NextRequest) {
  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  try {
    const { phoneNumber } = await req.json()

    if (!phoneNumber) {
      return NextResponse.json({ success: false, message: 'phoneNumber é obrigatório' }, { status: 400 })
    }

    const uazapi = await getUazapiForCompany(Number(context.companyId))
    await uazapi.sendPresence(phoneNumber, 'composing', 3000)

    return NextResponse.json({ success: true, message: 'Status de digitando enviado' })
  } catch (error: any) {
    // Não logar presença como erro crítico
    return NextResponse.json({ success: false, message: error.message || 'Erro ao enviar status' }, { status: 500 })
  }
}
