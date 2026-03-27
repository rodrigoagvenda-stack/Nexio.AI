import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { error } = await (supabase as any)
      .from("lancamentos_financeiros")
      .delete()
      .eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
