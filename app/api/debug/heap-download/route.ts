import { readFileSync } from 'fs'
import { resolve } from 'path'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const provided = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!cronSecret || provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const file = request.nextUrl.searchParams.get('file')
  if (!file) {
    return NextResponse.json({ error: 'file param obrigatório' }, { status: 400 })
  }

  const resolved = resolve(file)
  if (!resolved.startsWith('/tmp/')) {
    return NextResponse.json({ error: 'file deve estar em /tmp/' }, { status: 400 })
  }

  try {
    const data = readFileSync(resolved)
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
