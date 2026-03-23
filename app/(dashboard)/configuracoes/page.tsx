import { createClient } from "@/lib/supabase/server"
import { ConfiguracoesClient } from "./configuracoes-client"

export default async function ConfiguracoesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("*, igreja:igreja_id(*)")
    .eq("id", user.id)
    .single()

  return <ConfiguracoesClient profile={profile} />
}
