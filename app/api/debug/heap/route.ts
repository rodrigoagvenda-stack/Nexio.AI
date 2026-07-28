import { writeHeapSnapshot } from 'v8'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!cronSecret || provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const file = writeHeapSnapshot(`/tmp/heap-${Date.now()}.heapsnapshot`)
    return NextResponse.json({ file })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
