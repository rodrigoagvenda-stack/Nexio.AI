import { writeHeapSnapshot } from 'v8'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const file = writeHeapSnapshot()
  return NextResponse.json({ file })
}
