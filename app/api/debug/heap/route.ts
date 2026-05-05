import { writeHeapSnapshot } from 'v8'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Protegido por CRON_SECRET — apenas para diagnóstico temporário
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const file = writeHeapSnapshot()
    return NextResponse.json({ file, note: 'Download o arquivo do container e abra no Chrome DevTools Memory tab' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
