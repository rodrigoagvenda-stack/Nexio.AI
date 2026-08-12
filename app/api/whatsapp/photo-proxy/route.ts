import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url obrigatória' }, { status: 400 })

  try {
    const decoded = decodeURIComponent(url)
    if (!decoded.includes('pps.whatsapp.net') && !decoded.includes('lookaside.fbsbx.com')) {
      return NextResponse.json({ error: 'domínio não permitido' }, { status: 403 })
    }

    const res = await fetch(decoded, {
      headers: {
        'User-Agent': 'WhatsApp/2.23.24.76 A',
        Accept: 'image/*',
      },
    })

    if (!res.ok) {
      return new NextResponse(null, { status: res.status })
    }

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
