import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { testConnection } from "@/lib/uazapi"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { token, base_url } = await req.json()
  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 })
  if (!base_url) return NextResponse.json({ error: "URL base obrigatória" }, { status: 400 })

  const result = await testConnection({ base_url, token })
  if (result.ok) return NextResponse.json({ ok: true, detail: result.detail })
  return NextResponse.json({ error: "Falha na conexão", detail: result.detail }, { status: 502 })
}
