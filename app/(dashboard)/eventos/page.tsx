import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, MapPin, Plus } from "lucide-react"
import Link from "next/link"

const MESES_ABREV = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"]

function parseDateLocal(dateStr: string) {
  // dateStr is "YYYY-MM-DD" — parse as local to avoid UTC offset shifting the day
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function DateBadge({ dateStr }: { dateStr: string }) {
  const d = parseDateLocal(dateStr)
  return (
    <div className="flex flex-col items-center justify-center w-12 h-14 bg-white rounded-lg shadow-sm border border-gray-100 text-center">
      <span className="text-xl font-bold leading-none text-gray-800">
        {d.getDate()}
      </span>
      <span className="text-[10px] font-semibold tracking-wider text-amber-600 mt-0.5">
        {MESES_ABREV[d.getMonth()]}
      </span>
    </div>
  )
}

export default async function EventosPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">
          Você precisa estar autenticado para acessar esta página.
        </p>
      </div>
    )
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("igreja_id")
    .eq("id", user.id)
    .single()

  let eventos: any[] = []

  if (profile?.igreja_id) {
    const { data } = await (supabase as any)
      .from("eventos")
      .select(`
        *,
        igrejas:igreja_id (
          nome
        ),
        responsavel:responsavel_id (
          nome
        )
      `)
      .eq("igreja_id", profile.igreja_id)
      .order("data_inicio", { ascending: true })

    eventos = data || []
  }

  const hoje = new Date().toISOString().split("T")[0]
  const eventosFuturos = eventos.filter((e) => e.data_inicio >= hoje)
  const eventosPassados = eventos
    .filter((e) => e.data_inicio < hoje)
    .sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
            <CalendarDays className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
            <p className="text-sm text-muted-foreground">
              {eventos.length === 0
                ? "Nenhum evento cadastrado"
                : `${eventos.length} evento${eventos.length !== 1 ? "s" : ""} no total`}
            </p>
          </div>
        </div>
        <Link href="/eventos/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Evento
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {eventos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-5">
            <CalendarDays className="h-9 w-9 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Nenhum evento cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">
            Crie o primeiro evento da sua igreja e comece a organizar a agenda.
          </p>
          <Link href="/eventos/novo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Evento
            </Button>
          </Link>
        </div>
      )}

      {/* Próximos Eventos */}
      {eventosFuturos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <h2 className="text-base font-semibold">Próximos Eventos</h2>
            <span className="text-xs text-muted-foreground font-normal ml-1">
              ({eventosFuturos.length})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventosFuturos.map((evento) => (
              <Link key={evento.id} href={`/eventos/${evento.id}`}>
                <div className="group relative rounded-xl border bg-card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full flex flex-col">
                  {/* Top color strip */}
                  <div className="h-1 w-full bg-gradient-to-r from-green-400 to-emerald-500" />

                  <div className="p-4 flex flex-col flex-1">
                    {/* Date badge + name row */}
                    <div className="flex items-start gap-3">
                      <DateBadge dateStr={evento.data_inicio} />
                      <div className="flex-1 min-w-0 pt-0.5">
                        <h3 className="text-lg font-bold leading-snug line-clamp-2 text-card-foreground">
                          {evento.nome}
                        </h3>
                        {evento.tipo && (
                          <Badge variant="outline" className="mt-1.5 text-xs capitalize font-normal">
                            {evento.tipo}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="mt-4 space-y-2 flex-1">
                      {evento.local && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-1">{evento.local}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {evento.inscricoes_abertas && (
                      <div className="mt-3 pt-3 border-t">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Inscrições abertas
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Eventos Anteriores */}
      {eventosPassados.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <h2 className="text-base font-semibold text-muted-foreground">Eventos Anteriores</h2>
            <span className="text-xs text-muted-foreground/70 font-normal ml-1">
              ({eventosPassados.length})
            </span>
          </div>

          <div className="rounded-xl border divide-y overflow-hidden opacity-80">
            {eventosPassados.map((evento) => {
              const d = parseDateLocal(evento.data_inicio)
              const dataFormatada = d.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })

              return (
                <Link key={evento.id} href={`/eventos/${evento.id}`}>
                  <div className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/50 transition-colors cursor-pointer">
                    <span className="text-sm text-muted-foreground w-32 shrink-0">
                      {dataFormatada}
                    </span>
                    <span className="text-sm font-medium flex-1 line-clamp-1">
                      {evento.nome}
                    </span>
                    {evento.local && (
                      <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1 max-w-[140px]">{evento.local}</span>
                      </span>
                    )}
                    {evento.tipo && (
                      <Badge variant="outline" className="text-xs capitalize font-normal shrink-0">
                        {evento.tipo}
                      </Badge>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
