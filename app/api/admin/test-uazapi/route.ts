import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { token, instance, base_url } = await req.json()
  if (!token || !instance) return NextResponse.json({ error: "Token e instância obrigatórios" }, { status: 400 })

  try {
    const url = `${base_url || "https://api.uazapi.io"}/instance/${instance}/status`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`uazapi respondeu com status ${res.status}`)
    const data = await res.json()
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
