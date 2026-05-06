import { readFileSync } from 'fs'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const file = request.nextUrl.searchParams.get('file')
  if (!file || !file.startsWith('/tmp/')) {
    return NextResponse.json({ error: 'file param obrigatório e deve estar em /tmp/' }, { status: 400 })
  }

  try {
    const data = readFileSync(file)
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="heap.heapsnapshot"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
