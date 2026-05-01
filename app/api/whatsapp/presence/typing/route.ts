import { NextRequest, NextResponse } from 'next/server'
import { getUazapiForCompany } from '@/lib/sdr/uazapi-for-company'

export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, companyId } = await req.json()

    if (!phoneNumber || !companyId) {
      return NextResponse.json({ success: false, message: 'phoneNumber e companyId são obrigatórios' }, { status: 400 })
    }

    const uazapi = await getUazapiForCompany(Number(companyId))
    await uazapi.sendPresence(phoneNumber, 'composing', 3000)

    return NextResponse.json({ success: true, message: 'Status de digitando enviado' })
  } catch (error: any) {
    // Não logar presença como erro crítico
    return NextResponse.json({ success: false, message: error.message || 'Erro ao enviar status' }, { status: 500 })
  }
}
