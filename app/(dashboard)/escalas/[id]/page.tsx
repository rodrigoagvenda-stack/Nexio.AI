import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import EscalaClient from "./escala-client"

export default async function EscalaDetalhePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Get current user profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, nome, igreja_id, igrejas:igrejas(id, nome)")
    .eq("id", user.id)
    .single()

  // Get the escala
  const { data: escala } = await (supabase as any)
    .from("escalas")
    .select("id, mes, ano, status, data_geracao, igreja_id")
    .eq("id", params.id)
    .single()

  if (!escala) notFound()

  // Get church name and type for the print header
  const igrejId2 = escala.igreja_id ?? profile?.igreja_id
  const { data: igrejaData } = igrejId2
    ? await (supabase as any).from("igrejas").select("id, nome, tipo, logo_url").eq("id", igrejId2).single()
    : { data: null }

  // Get escalas_detalhes with joined member names
  const { data: detalhesRaw } = await (supabase as any)
    .from("escalas_detalhes")
    .select(`
      id, data_culto, dia_semana, horario, tipo_culto, observacoes,
      membro_oracao_id, membro_louvor_id, membro_pregacao_id,
      membro_som_id, membro_recepcao_id, membro_midia_id, membro_infantil_id,
      membro_oracao:membros!membro_oracao_id(id, nome),
      membro_louvor:membros!membro_louvor_id(id, nome),
      membro_pregacao:membros!membro_pregacao_id(id, nome),
      membro_som:membros!membro_som_id(id, nome),
      membro_recepcao:membros!membro_recepcao_id(id, nome),
      membro_midia:membros!membro_midia_id(id, nome),
      membro_infantil:membros!membro_infantil_id(id, nome)
    `)
    .eq("escala_id", params.id)
    .order("data_culto", { ascending: true })

  const detalhes: any[] = detalhesRaw || []

  // Get all active members of the church for dropdowns
  const igrejId = escala.igreja_id ?? profile?.igreja_id
  const { data: membrosRaw } = igrejId
    ? await (supabase as any)
        .from("membros")
        .select("id, nome")
        .eq("igreja_id", igrejId)
        .eq("status", "ativo")
        .order("nome", { ascending: true })
    : { data: [] }

  const membros: { id: string; nome: string }[] = membrosRaw || []

  return (
    <EscalaClient
      escala={escala}
      detalhes={detalhes}
      membros={membros}
      profile={profile}
      igreja={igrejaData ?? null}
    />
  )
}
