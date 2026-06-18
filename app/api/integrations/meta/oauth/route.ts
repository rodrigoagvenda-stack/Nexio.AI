import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { createHmac } from 'crypto'

const APP_ID     = process.env.META_APP_ID!
const APP_SECRET = process.env.META_APP_SECRET!
const REDIRECT   = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/meta/callback`
  : 'https://app.zaapply.com.br/api/integrations/meta/callback'

function signState(payload: string): string {
  return createHmac('sha256', APP_SECRET).update(payload).digest('hex')
}

export async function GET(req: NextRequest) {
  if (!APP_ID || !APP_SECRET) {
    return NextResponse.json({ error: 'META_APP_ID / META_APP_SECRET não configurados' }, { status: 503 })
  }

  const { context, error: authError } = await requireAuth(req)
  if (authError) return authError

  const payload = Buffer.from(JSON.stringify({ cid: context.companyId, ts: Date.now() })).toString('base64url')
  const sig     = signState(payload)
  const state   = `${payload}.${sig}`

  const params = new URLSearchParams({
    client_id:    APP_ID,
    redirect_uri: REDIRECT,
    scope:        'ads_read,business_management',
    state,
    response_type: 'code',
  })

  return NextResponse.redirect(`https://www.facebook.com/v25.0/dialog/oauth?${params}`)
}
