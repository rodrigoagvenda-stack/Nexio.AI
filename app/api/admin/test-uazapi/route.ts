import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { token, instance, base_url } = await req.json()
  if (!token || !instance) return NextResponse.json({ error: "Token e instância obrigatórios" }, { status: 400 })

  const base = (base_url || "https://api.uazapi.io").replace(/\/$/, "")

  // uazapi uses "apikey" header — try fetchInstances endpoint first
  const endpoints = [
    `${base}/instance/fetchInstances`,
    `${base}/instance/connectionState/${encodeURIComponent(instance)}`,
    `${base}/instance/${encodeURIComponent(instance)}/status`,
    `${base}/status`,
  ]

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": token,
    "Authorization": `Bearer ${token}`,
  }

  let lastError = ""
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(8000),
      })
      const text = await res.text()
      let data: any = text
      try { data = JSON.parse(text) } catch { /* keep as text */ }

      if (res.ok) return NextResponse.json({ ok: true, data, endpoint: url })
      lastError = `${url} → ${res.status}: ${text.slice(0, 200)}`
    } catch (e: any) {
      lastError = `${url} → ${e.message}`
    }
  }

  return NextResponse.json({ error: `Falha em todos os endpoints. Último erro: ${lastError}` }, { status: 502 })
}
