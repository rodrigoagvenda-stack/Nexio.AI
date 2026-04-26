"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Loader2, HandHeart, ShoppingCart, Flame, Home, Pill, HelpCircle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from "lucide-react"

interface Pedido {
  id: string
  nome: string
  telefone: string
  para: string
  nome_beneficiario: string | null
  tipo_ajuda: string
  endereco: string
  status: "pendente" | "em_analise" | "atendido" | "cancelado"
  observacoes: string | null
  created_at: string
  membros?: { nome: string } | null
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  "Cesta básica":    <ShoppingCart className="h-4 w-4" />,
  "Gás de cozinha":  <Flame className="h-4 w-4" />,
  "Aluguel/moradia": <Home className="h-4 w-4" />,
  "Remédio":         <Pill className="h-4 w-4" />,
}

const STATUS_CONFIG = {
  pendente:    { label: "Pendente",     cls: "bg-amber-500/10 text-amber-700 border-amber-500/20",   icon: <Clock className="h-3.5 w-3.5" /> },
  em_analise:  { label: "Em análise",   cls: "bg-blue-500/10 text-blue-700 border-blue-500/20",      icon: <Loader2 className="h-3.5 w-3.5" /> },
  atendido:    { label: "Atendido",     cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelado:   { label: "Cancelado",    cls: "bg-red-500/10 text-red-700 border-red-500/20",          icon: <XCircle className="h-3.5 w-3.5" /> },
}

export default function AssistenciaPage() {
  const { toast } = useToast()
  const [pedidos, setPedidos]   = useState<Pedido[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => { fetch_() }, [filtro])

  async function fetch_() {
    setLoading(true)
    try {
      const params = filtro ? `?status=${filtro}` : ""
      const res  = await fetch(`/api/assistencia${params}`)
      const json = await res.json()
      setPedidos(json.data ?? [])
    } catch {
      toast({ variant: "destructive", title: "Erro ao carregar pedidos" })
    } finally { setLoading(false) }
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    try {
      await fetch("/api/assistencia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      toast({ title: "Status atualizado!" })
      fetch_()
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally { setUpdating(null) }
  }

  const pendentes    = pedidos.filter(p => p.status === "pendente").length
  const em_analise   = pedidos.filter(p => p.status === "em_analise").length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HandHeart className="h-6 w-6 text-primary" />
            Assistência Social
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pedidos de ajuda recebidos via WhatsApp</p>
        </div>
        {(pendentes + em_analise) > 0 && (
          <span className="flex items-center gap-1.5 text-sm font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20 px-3 py-1.5 rounded-full">
            <Clock className="h-4 w-4" />
            {pendentes + em_analise} aguardando atenção
          </span>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: "",           label: "Todos" },
          { v: "pendente",   label: "Pendentes" },
          { v: "em_analise", label: "Em análise" },
          { v: "atendido",   label: "Atendidos" },
          { v: "cancelado",  label: "Cancelados" },
        ].map(({ v, label }) => (
          <Button key={v} variant={filtro === v ? "default" : "outline"} size="sm" onClick={() => setFiltro(v)}>
            {label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pedidos.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl py-16 text-center">
          <HandHeart className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum pedido encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Os pedidos chegam automaticamente via WhatsApp</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => {
            const st  = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pendente
            const ico = TIPO_ICON[p.tipo_ajuda] ?? <HelpCircle className="h-4 w-4" />
            const dt  = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
            const isExp = expanded === p.id

            return (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-start gap-4 p-4">
                  {/* Ícone tipo */}
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {ico}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold">{p.nome}</p>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>
                        {st.icon} {st.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{p.tipo_ajuda}</span>
                      {p.para === "outro" && p.nome_beneficiario && ` — para ${p.nome_beneficiario}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{dt} · {p.telefone}</p>
                  </div>

                  {/* Expand */}
                  <button
                    onClick={() => setExpanded(isExp ? null : p.id)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Expandido */}
                {isExp && (
                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Endereço</p>
                        <p>{p.endereco || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Beneficiário</p>
                        <p>{p.para === "outro" ? (p.nome_beneficiario || "—") : "Próprio solicitante"}</p>
                      </div>
                    </div>

                    {/* Ações de status */}
                    {p.status !== "atendido" && p.status !== "cancelado" && (
                      <div className="flex gap-2 flex-wrap">
                        {p.status === "pendente" && (
                          <Button size="sm" variant="outline" className="gap-2" disabled={!!updating}
                            onClick={() => updateStatus(p.id, "em_analise")}>
                            {updating === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Loader2 className="h-3.5 w-3.5" />}
                            Em análise
                          </Button>
                        )}
                        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={!!updating}
                          onClick={() => updateStatus(p.id, "atendido")}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Marcar como atendido
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-2 text-destructive hover:bg-destructive/10" disabled={!!updating}
                          onClick={() => updateStatus(p.id, "cancelado")}>
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
