import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 })

  const ext  = file.name.split(".").pop() ?? "bin"
  const path = `comunicacao/${user.id}/${Date.now()}.${ext}`

  const { data, error } = await (supabase as any).storage
    .from("user-uploads")
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = (supabase as any).storage
    .from("user-uploads")
    .getPublicUrl(data.path)

  return NextResponse.json({ url: publicUrl, name: file.name, type: file.type })
}
