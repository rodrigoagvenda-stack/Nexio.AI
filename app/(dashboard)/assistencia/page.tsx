"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import {
  Loader2, HeartHandshake, ShoppingCart, Flame, Home, Pill,
  HelpCircle, CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
  Phone, MapPin, User, Users, AlertCircle,
} from "lucide-react"

interface Pedido {
  id: string
  nome: string
  telefone: string | null
  para: string
  nome_beneficiario: string | null
  tipo_ajuda: string
  endereco: string | null
  status: "pendente" | "em_analise" | "atendido" | "cancelado"
  observacoes: string | null
  created_at: string
  membros?: { nome: string } | null
}

const TIPO_CONFIG: Record<string, { icon: React.ReactNode; cor: string }> = {
  "Cesta básica":    { icon: <ShoppingCart className="h-4 w-4" />, cor: "text-amber-600 bg-amber-500/10" },
  "Gás de cozinha":  { icon: <Flame className="h-4 w-4" />,        cor: "text-orange-600 bg-orange-500/10" },
  "Aluguel/moradia": { icon: <Home className="h-4 w-4" />,         cor: "text-blue-600 bg-blue-500/10" },
  "Remédio":         { icon: <Pill className="h-4 w-4" />,         cor: "text-red-600 bg-red-500/10" },
}

const STATUS_CONFIG = {
  pendente:   { label: "Pendente",    cls: "bg-amber-500/10 text-amber-700 border-amber-500/20",     icon: <Clock className="h-3 w-3" /> },
  em_analise: { label: "Em análise",  cls: "bg-blue-500/10 text-blue-700 border-blue-500/20",        icon: <AlertCircle className="h-3 w-3" /> },
  atendido:   { label: "Atendido",    cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelado:  { label: "Cancelado",   cls: "bg-red-500/10 text-red-700 border-red-500/20",            icon: <XCircle className="h-3 w-3" /> },
}

export default function AssistenciaPage() {
  const { toast } = useToast()
  const [pedidos, setPedidos]   = useState<Pedido[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtro, setFiltro]     = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => { fetchPedidos() }, [filtro])

  async function fetchPedidos() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/assistencia${filtro ? `?status=${filtro}` : ""}`)
      const json = await res.json()
      setPedidos(json.data ?? [])
    } catch {
      toast({ variant: "destructive", title: "Erro ao carregar pedidos" })
    } finally { setLoading(false) }
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    try {
      const res = await fetch("/api/assistencia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error("Erro")
      toast({ title: status === "atendido" ? "Marcado como atendido!" : "Status atualizado!" })
      fetchPedidos()
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    } finally { setUpdating(null) }
  }

  const pendentes   = pedidos.filter(p => p.status === "pendente").length
  const em_analise  = pedidos.filter(p => p.status === "em_analise").length
  const atencao     = pendentes + em_analise

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartHandshake className="h-6 w-6 text-primary" />
            Assistência Social
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pedidos de ajuda recebidos via WhatsApp</p>
        </div>
        {atencao > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-medium bg-amber-500/10 text-amber-700 border border-amber-500/20 px-3 py-1.5 rounded-full">
            <Clock className="h-4 w-4" />
            {atencao} aguardando atenção
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: "",           l: "Todos" },
          { v: "pendente",   l: `Pendentes${pendentes > 0 ? ` (${pendentes})` : ""}` },
          { v: "em_analise", l: "Em análise" },
          { v: "atendido",   l: "Atendidos" },
          { v: "cancelado",  l: "Cancelados" },
        ].map(({ v, l }) => (
          <Button key={v} variant={filtro === v ? "default" : "outline"} size="sm" onClick={() => setFiltro(v)}>
            {l}
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
          <HeartHandshake className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum pedido{filtro ? " com este filtro" : ""}</p>
          {!filtro && <p className="text-xs text-muted-foreground mt-1">Os pedidos chegam via WhatsApp automaticamente</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {pedidos.map(p => {
            const st     = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pendente
            const tipoC  = TIPO_CONFIG[p.tipo_ajuda] ?? { icon: <HelpCircle className="h-4 w-4" />, cor: "text-muted-foreground bg-muted" }
            const dt     = new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
            const hora   = new Date(p.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
            const isExp  = expanded === p.id
            const isAtualizado = updating === p.id

            return (
              <div key={p.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${p.status === "pendente" ? "border-amber-500/30" : "border-border"}`}>

                {/* Header do card */}
                <div className="flex items-start gap-4 p-4">
                  {/* Ícone tipo */}
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${tipoC.cor}`}>
                    {tipoC.icon}
                  </div>

                  {/* Informações principais */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-base">{p.nome || "Nome não informado"}</p>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>
                            {st.icon} {st.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-primary">{p.tipo_ajuda}</p>
                        {p.para === "outro" && p.nome_beneficiario && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Users className="h-3 w-3" /> Para: {p.nome_beneficiario}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setExpanded(isExp ? null : p.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
                      >
                        {isExp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {p.telefone && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {p.telefone}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{dt} às {hora}</span>
                    </div>
                  </div>
                </div>

                {/* Detalhes expandidos */}
                {isExp && (
                  <div className="border-t border-border">
                    <div className="p-4 space-y-4">

                      {/* Grid de informações */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <User className="h-3 w-3" /> Solicitante
                          </p>
                          <p className="text-sm font-medium">{p.nome}</p>
                          {p.membros?.nome && p.membros.nome !== p.nome && (
                            <p className="text-xs text-muted-foreground mt-0.5">Membro: {p.membros.nome}</p>
                          )}
                          {p.telefone && <p className="text-xs text-muted-foreground mt-0.5">{p.telefone}</p>}
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <HeartHandshake className="h-3 w-3" /> Beneficiário
                          </p>
                          <p className="text-sm">
                            {p.para === "outro" ? (p.nome_beneficiario || "Outra pessoa") : "Próprio solicitante"}
                          </p>
                        </div>

                        {p.endereco && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> Endereço
                            </p>
                            <p className="text-sm bg-muted/50 rounded-lg px-3 py-2">{p.endereco}</p>
                          </div>
                        )}

                        {p.observacoes && (
                          <div className="sm:col-span-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Observações</p>
                            <p className="text-sm text-muted-foreground">{p.observacoes}</p>
                          </div>
                        )}
                      </div>

                      {/* Ações */}
                      {p.status !== "atendido" && p.status !== "cancelado" && (
                        <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
                          {p.status === "pendente" && (
                            <Button size="sm" variant="outline" className="gap-2" disabled={!!isAtualizado}
                              onClick={() => updateStatus(p.id, "em_analise")}>
                              {isAtualizado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertCircle className="h-3.5 w-3.5" />}
                              Colocar em análise
                            </Button>
                          )}
                          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!!isAtualizado}
                            onClick={() => updateStatus(p.id, "atendido")}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Marcar como atendido
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-2 text-destructive hover:bg-destructive/10" disabled={!!isAtualizado}
                            onClick={() => updateStatus(p.id, "cancelado")}>
                            <XCircle className="h-3.5 w-3.5" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
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
