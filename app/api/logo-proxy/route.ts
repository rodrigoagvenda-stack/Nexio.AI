import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Proxy server-side para converter logo em base64 — evita CORS no print do browser
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const url = searchParams.get("url")
  if (!url) return NextResponse.json({ error: "url obrigatória" }, { status: 400 })

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return NextResponse.json({ error: "Falha ao buscar imagem" }, { status: 502 })

    const contentType = res.headers.get("content-type") || "image/png"
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")

    return NextResponse.json({ base64: `data:${contentType};base64,${base64}` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
