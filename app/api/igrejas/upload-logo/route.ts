import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File
    const igrejaId = formData.get("igrejaId") as string

    if (!file) return NextResponse.json({ error: "Nenhum arquivo" }, { status: 400 })

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"]
    if (!allowed.includes(file.type))
      return NextResponse.json({ error: "Use JPG, PNG, WEBP ou SVG" }, { status: 400 })

    if (file.size > 2 * 1024 * 1024)
      return NextResponse.json({ error: "Máximo 2MB" }, { status: 400 })

    const ext = file.name.split(".").pop()
    const filePath = `igrejas/${igrejaId ?? `temp-${Date.now()}`}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("user-uploads")
      .upload(filePath, file, { cacheControl: "3600", upsert: true })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from("user-uploads").getPublicUrl(filePath)

    if (igrejaId) {
      await (supabase as any).from("igrejas").update({ logo_url: publicUrl }).eq("id", igrejaId)
    }

    return NextResponse.json({ logo_url: publicUrl })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
