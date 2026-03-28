import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, Sparkles } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  confirmando: "Confirmando",
  finalizada: "Finalizada",
  enviada: "Enviada",
}

// Tailwind color classes for each status
const STATUS_COLORS: Record<string, { badge: string; dot: string }> = {
  rascunho:    { badge: "bg-muted text-muted-foreground border-border",             dot: "bg-muted-foreground" },
  confirmando: { badge: "bg-blue-50 text-blue-700 border-blue-200",                 dot: "bg-blue-500" },
  finalizada:  { badge: "bg-[#C1BC7A]/10 text-[#8a8345] border-[#C1BC7A]/30",       dot: "bg-[#C1BC7A]" },
  enviada:     { badge: "bg-[#C1BC7A]/15 text-[#7a753a] border-[#C1BC7A]/40",       dot: "bg-[#C1BC7A]" },
}

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

export default async function EscalasPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("igreja_id")
    .eq("id", user.id)
    .single()

  let escalas: any[] = []

  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("escalas")
      .select("id, mes, ano, status, data_geracao")
      .eq("igreja_id", profile.igreja_id)
      .order("ano", { ascending: false })
      .order("mes", { ascending: false })
      .limit(20)

    escalas = data || []
  }

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Escalas de Culto</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie as escalas mensais de voluntários e equipes
            </p>
          </div>
        </div>
        <Link href="/escalas/nova">
          <Button className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Nova Escala
          </Button>
        </Link>
      </div>

      {/* Auto-generation hint */}
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 px-4 py-3">
        <Sparkles className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Geração automática:</span>{" "}
          Ao criar uma nova escala, o sistema distribui automaticamente os voluntários cadastrados
          nos cultos do mês, respeitando disponibilidade e histórico de participações.
        </p>
      </div>

      {/* Empty state */}
      {escalas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 py-20 text-center px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-5">
            <Calendar className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">
            Nenhuma escala criada ainda
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Crie a primeira escala do mês e o sistema distribuirá os voluntários automaticamente.
          </p>
          <Link href="/escalas/nova">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeira Escala
            </Button>
          </Link>
        </div>
      ) : (
        /* Escalas grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {escalas.map((escala) => {
            const isCurrentMonth =
              escala.mes === currentMonth && escala.ano === currentYear
            const colors = STATUS_COLORS[escala.status] ?? STATUS_COLORS.rascunho
            const geradaEm = escala.data_geracao
              ? new Date(escala.data_geracao).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : null

            return (
              <Link key={escala.id} href={`/escalas/${escala.id}`} className="group block">
                <div
                  className={cn(
                    "relative flex flex-col gap-4 rounded-xl border bg-card p-5 h-full",
                    "transition-all duration-200",
                    "hover:shadow-md hover:-translate-y-0.5",
                    isCurrentMonth
                      ? "border-primary/40 ring-1 ring-primary/20 shadow-sm"
                      : "border-border hover:border-muted-foreground/30",
                  )}
                >
                  {/* Current month indicator */}
                  {isCurrentMonth && (
                    <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-widest text-primary/70">
                      Mês atual
                    </span>
                  )}

                  {/* Month name + year */}
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                      {MESES[escala.mes]}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 font-medium">
                      {escala.ano}
                    </p>
                  </div>

                  {/* Footer: status badge + date */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/60">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        colors.badge,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
                      {STATUS_LABELS[escala.status] ?? escala.status}
                    </span>
                    {geradaEm && (
                      <span className="text-xs text-muted-foreground">{geradaEm}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
