"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  MessageSquare, Search, Plus, Send, Bot, Sparkles, UserCheck,
  Users, Heart, Eye, ChevronDown, X, Phone, Loader2, AlertCircle,
  CheckCheck, Check, Clock, Wifi, WifiOff, RefreshCw, MoreVertical,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversa {
  id: string
  telefone: string
  nome_contato: string
  status: string
  tipo_fluxo: string | null
  ia_ativa: boolean
  ultima_mensagem: string | null
  ultima_msg_at: string | null
  nao_lidas: number
  resumo_ia: string | null
  contatos?: { tipo: string; foto_url?: string | null }
}

interface Mensagem {
  id: string
  conversa_id: string
  direcao: "entrada" | "saida"
  conteudo: string
  tipo: string
  status: string
  ia_gerada: boolean
  created_at: string
}

interface Membro { id: string; nome: string; telefone: string | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#8a8345","#C1BC7A","#1d4ed8","#7c3aed","#b45309","#0f766e","#9f1239"]
function avatarColor(name: string) {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function getInitials(name: string) {
  const p = name.trim().split(" ").filter(Boolean)
  return p.length === 1 ? p[0].substring(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function timeAgo(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60)   return "agora"
  if (diff < 3600) return `${Math.floor(diff/60)}min`
  if (diff < 86400) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}
function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const FLUXO_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  escala:    { label: "Confirmação Escala", icon: "📋", color: "text-blue-600 bg-blue-500/10" },
  pastoral:  { label: "Acompanhamento",     icon: "✝️",  color: "text-emerald-600 bg-emerald-500/10" },
  visitante: { label: "Visitante",          icon: "👋",  color: "text-amber-600 bg-amber-500/10" },
  convertido:{ label: "Novo Convertido",    icon: "🕊️",  color: "text-purple-600 bg-purple-500/10" },
}

const STATUS_MSG: Record<string, React.ReactNode> = {
  enviado:   <Check className="h-3.5 w-3.5" />,
  entregue:  <CheckCheck className="h-3.5 w-3.5" />,
  lido:      <CheckCheck className="h-3.5 w-3.5 text-blue-400" />,
  falhou:    <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
  pendente:  <Clock className="h-3.5 w-3.5" />,
}

// ─── NovaConversa modal ───────────────────────────────────────────────────────

function ModalNovaConversa({ membros, onClose, onCriar }: {
  membros: Membro[]
  onClose: () => void
  onCriar: (dados: { telefone: string; nome: string; tipo: string; membro_id?: string; tipo_fluxo?: string }) => void
}) {
  const [modo, setModo]     = useState<"membro" | "visitante">("membro")
  const [query, setQuery]   = useState("")
  const [sel, setSel]       = useState<Membro | null>(null)
  const [nome, setNome]     = useState("")
  const [telefone, setTelefone] = useState("")
  const [fluxo, setFluxo]   = useState("pastoral")

  const filtrado = membros.filter(m =>
    m.nome.toLowerCase().includes(query.toLowerCase()) && m.telefone
  ).slice(0, 20)

  function submit() {
    if (modo === "membro") {
      if (!sel?.telefone) return
      onCriar({ telefone: sel.telefone, nome: sel.nome, tipo: "membro", membro_id: sel.id, tipo_fluxo: fluxo })
    } else {
      if (!nome || !telefone) return
      onCriar({ telefone, nome, tipo: "visitante", tipo_fluxo: fluxo })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Nova Conversa</h3>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo de contato */}
          <div className="flex gap-2">
            {[
              { v: "membro",    label: "Membro",    icon: <Users className="h-3.5 w-3.5" /> },
              { v: "visitante", label: "Visitante",  icon: <UserCheck className="h-3.5 w-3.5" /> },
            ].map(({ v, label, icon }) => (
              <button key={v} onClick={() => setModo(v as any)}
                className={`flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium border transition-colors ${modo === v ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                {icon} {label}
              </button>
            ))}
          </div>

          {modo === "membro" ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input placeholder="Buscar membro…" value={query} onChange={e => { setQuery(e.target.value); setSel(null) }} className="pl-9" />
              </div>
              {sel ? (
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: avatarColor(sel.nome) }}>
                    {getInitials(sel.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{sel.nome}</p>
                    <p className="text-xs text-muted-foreground">{sel.telefone}</p>
                  </div>
                  <button onClick={() => setSel(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : query ? (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                  {filtrado.length === 0 ? (
                    <p className="text-xs text-center text-muted-foreground py-4">Nenhum membro com telefone cadastrado</p>
                  ) : filtrado.map(m => (
                    <button key={m.id} onClick={() => { setSel(m); setQuery("") }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: avatarColor(m.nome) }}>
                        {getInitials(m.nome)}
                      </div>
                      <span className="truncate">{m.nome}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <Input placeholder="Nome do visitante" value={nome} onChange={e => setNome(e.target.value)} />
              <Input placeholder="WhatsApp (ex: 5511999999999)" value={telefone} onChange={e => setTelefone(e.target.value)} />
            </div>
          )}

          {/* Fluxo SDR */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fluxo da IA SDR</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(FLUXO_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => setFluxo(k)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${fluxo === k ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"}`}>
                  <span>{v.icon}</span> {v.label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full gap-2" onClick={submit} disabled={modo === "membro" ? !sel : !nome || !telefone}>
            <MessageSquare className="h-4 w-4" /> Iniciar Conversa
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComunicacaoPage() {
  const { toast } = useToast()

  const [conversas, setConversas]   = useState<Conversa[]>([])
  const [mensagens, setMensagens]   = useState<Mensagem[]>([])
  const [membros, setMembros]       = useState<Membro[]>([])
  const [convAtiva, setConvAtiva]   = useState<Conversa | null>(null)
  const [loadingConv, setLoadingConv] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const [sdrLoading, setSdrLoading] = useState(false)
  const [texto, setTexto]           = useState("")
  const [query, setQuery]           = useState("")
  const [modalAberto, setModalAberto] = useState(false)
  const [igrejaId, setIgrejaId]     = useState("")
  const [resumoAberto, setResumoAberto] = useState(false)
  const msgEndRef = useRef<HTMLDivElement>(null)

  // Load initial data
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase as any).from("profiles").select("igreja_id").eq("id", user.id).single()
        .then(async ({ data }: any) => {
          if (!data?.igreja_id) return
          setIgrejaId(data.igreja_id)
          const { data: mbs } = await (supabase as any).from("membros").select("id, nome, telefone").eq("igreja_id", data.igreja_id).eq("status", "ativo").order("nome")
          setMembros((mbs ?? []).filter((m: any) => m.telefone))
        })
    })
    fetchConversas()

    // Auto-refresh a cada 8 segundos para receber novas conversas/mensagens
    const interval = setInterval(fetchConversas, 8000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchConversas() {
    setLoadingConv(true)
    try {
      const res = await fetch("/api/comunicacao/conversas")
      const json = await res.json()
      setConversas(json.data ?? [])
    } catch { toast({ variant: "destructive", title: "Erro ao carregar conversas" }) }
    finally { setLoadingConv(false) }
  }

  async function fetchMensagens(conv: Conversa) {
    setLoadingMsg(true)
    setMensagens([])
    try {
      const res = await fetch(`/api/comunicacao/mensagens?conversa_id=${conv.id}`)
      const json = await res.json()
      setMensagens(json.data ?? [])
    } catch { toast({ variant: "destructive", title: "Erro ao carregar mensagens" }) }
    finally { setLoadingMsg(false) }
  }

  useEffect(() => {
    if (!convAtiva) return
    fetchMensagens(convAtiva)
    // Atualiza mensagens a cada 5s enquanto a conversa está aberta
    const interval = setInterval(() => fetchMensagens(convAtiva), 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convAtiva?.id])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensagens])

  async function sendMsg() {
    if (!texto.trim() || !convAtiva) return
    const msg = texto.trim()
    setTexto("")
    setSendingMsg(true)
    try {
      const res = await fetch("/api/comunicacao/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversa_id: convAtiva.id, conteudo: msg }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMensagens(prev => [...prev, json.data])
      if (json.sendError) toast({ variant: "destructive", title: "Mensagem salva, mas falhou no WhatsApp", description: json.sendError })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao enviar", description: e.message })
      setTexto(msg)
    } finally { setSendingMsg(false) }
  }

  async function triggerSDR(primeiro = false) {
    if (!convAtiva) return
    setSdrLoading(true)
    try {
      const res = await fetch("/api/comunicacao/sdr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversa_id: convAtiva.id,
          historico: mensagens,
          fluxo: convAtiva.tipo_fluxo || "pastoral",
          contexto: { nome_membro: convAtiva.nome_contato },
          primeiro_contato: primeiro,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      if (primeiro) {
        toast({ title: "Mensagem interativa enviada!" })
        await fetchMensagens(convAtiva)
        return
      }

      if (json.resposta) {
        setMensagens(prev => [...prev, {
          id: `tmp-${Date.now()}`,
          conversa_id: convAtiva.id,
          direcao: "saida",
          conteudo: json.resposta,
          tipo: "texto",
          status: "enviado",
          ia_gerada: true,
          created_at: new Date().toISOString(),
        }])
      }
      if (json.alerta) toast({ title: "⚠️ Alerta enviado ao pastor responsável" })
      if (json.resumo) {
        setConvAtiva(prev => prev ? { ...prev, resumo_ia: json.resumo } : prev)
        setConversas(prev => prev.map(c => c.id === convAtiva.id ? { ...c, resumo_ia: json.resumo } : c))
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro na IA SDR", description: e.message })
    } finally { setSdrLoading(false) }
  }

  async function toggleIA() {
    if (!convAtiva) return
    const novoEstado = !convAtiva.ia_ativa
    const supabase = createClient()
    await (supabase as any).from("conversas_whatsapp").update({ ia_ativa: novoEstado }).eq("id", convAtiva.id)
    setConvAtiva(prev => prev ? { ...prev, ia_ativa: novoEstado } : prev)
    setConversas(prev => prev.map(c => c.id === convAtiva.id ? { ...c, ia_ativa: novoEstado } : c))
    toast({ title: novoEstado ? "IA SDR ativada — responderá automaticamente" : "IA SDR desativada" })
  }

  async function criarConversa(dados: any) {
    try {
      const res = await fetch("/api/comunicacao/conversas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      await fetchConversas()
      toast({ title: "Conversa iniciada!" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    }
  }

  const convsFiltradas = conversas.filter(c =>
    c.nome_contato?.toLowerCase().includes(query.toLowerCase()) ||
    c.telefone?.includes(query)
  )

  const fluxoInfo = convAtiva?.tipo_fluxo ? FLUXO_LABELS[convAtiva.tipo_fluxo] : null

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">

      {/* ── Lista de conversas ── */}
      <div className={`flex flex-col border-r border-border bg-card ${convAtiva ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 shrink-0`}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Comunicação</h2>
              <p className="text-xs text-muted-foreground">{conversas.length} conversa{conversas.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={fetchConversas} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Atualizar">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setModalAberto(true)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" title="Nova conversa">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input placeholder="Buscar conversa…" value={query} onChange={e => setQuery(e.target.value)} className="pl-8 h-8 text-sm bg-muted/50 border-0" />
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConv ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : convsFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {query ? "Nenhuma conversa encontrada" : "Nenhuma conversa ainda"}
              </p>
              {!query && (
                <button onClick={() => setModalAberto(true)} className="mt-3 text-xs text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Nova conversa
                </button>
              )}
            </div>
          ) : (
            convsFiltradas.map(conv => {
              const isAtiva = convAtiva?.id === conv.id
              const fluxo   = conv.tipo_fluxo ? FLUXO_LABELS[conv.tipo_fluxo] : null
              return (
                <button
                  key={conv.id}
                  onClick={() => setConvAtiva(conv)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b border-border/50 ${isAtiva ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: avatarColor(conv.nome_contato || "?") }}>
                      {getInitials(conv.nome_contato || "?")}
                    </div>
                    {conv.ia_ativa && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card flex items-center justify-center">
                        <Bot className="h-2.5 w-2.5 text-primary" />
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-medium truncate">{conv.nome_contato}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.ultima_msg_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {fluxo && <span className="text-[10px]">{fluxo.icon}</span>}
                      <p className="text-xs text-muted-foreground truncate flex-1">
                        {conv.ultima_mensagem || "Sem mensagens"}
                      </p>
                      {conv.nao_lidas > 0 && (
                        <span className="shrink-0 h-4 min-w-[16px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                          {conv.nao_lidas}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* SDR status bar */}
        <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#C1BC7A]" />
          <p className="text-xs text-muted-foreground">IA SDR ativa em <strong>{conversas.filter(c => c.ia_ativa).length}</strong> conversa{conversas.filter(c => c.ia_ativa).length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* ── Chat panel ── */}
      {convAtiva ? (
        <div className="flex-1 flex flex-col min-w-0 bg-background">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
            {/* Back (mobile) */}
            <button onClick={() => setConvAtiva(null)} className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>

            {/* Avatar */}
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: avatarColor(convAtiva.nome_contato || "?") }}>
              {getInitials(convAtiva.nome_contato || "?")}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{convAtiva.nome_contato}</p>
                {fluxoInfo && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${fluxoInfo.color}`}>
                    {fluxoInfo.icon} {fluxoInfo.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{convAtiva.telefone}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Resumo IA */}
              {convAtiva.resumo_ia && (
                <button onClick={() => setResumoAberto(v => !v)}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium bg-[#C1BC7A]/10 text-[#8a8345] hover:bg-[#C1BC7A]/20 transition-colors border border-[#C1BC7A]/20">
                  <Eye className="h-3.5 w-3.5" /> Resumo
                </button>
              )}

              {/* IA toggle */}
              <button onClick={toggleIA}
                className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors border ${convAtiva.ia_ativa ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}>
                <Bot className="h-3.5 w-3.5" />
                {convAtiva.ia_ativa ? "IA Ativa" : "IA Off"}
              </button>

              {/* Iniciar SDR (primeiro contato) */}
              {mensagens.length === 0 && (
                <button onClick={() => triggerSDR(true)} disabled={sdrLoading}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold bg-[#C1BC7A] text-[#1a1a1a] hover:bg-[#a8a35e] transition-colors disabled:opacity-50">
                  {sdrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Iniciar SDR
                </button>
              )}

              {/* Resposta SDR (conversa em andamento) */}
              {mensagens.length > 0 && (
                <button onClick={() => triggerSDR(false)} disabled={sdrLoading}
                  className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 border border-border transition-colors disabled:opacity-50">
                  {sdrLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[#C1BC7A]" />}
                  Resposta SDR
                </button>
              )}
            </div>
          </div>

          {/* Resumo IA panel */}
          {resumoAberto && convAtiva.resumo_ia && (
            <div className="shrink-0 px-4 py-3 bg-[#C1BC7A]/5 border-b border-[#C1BC7A]/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 flex-1">
                  <Sparkles className="h-4 w-4 text-[#8a8345] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-[#8a8345] mb-1">Resumo gerado pela IA SDR</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{convAtiva.resumo_ia}</p>
                  </div>
                </div>
                <button onClick={() => setResumoAberto(false)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)", backgroundSize: "20px 20px" }}>
            {loadingMsg ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em <strong>Resposta SDR</strong> para a IA iniciar</p>
              </div>
            ) : (
              mensagens.map((msg, i) => {
                const isSaida = msg.direcao === "saida"
                const prevMsg = mensagens[i - 1]
                const showTime = !prevMsg || new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000

                return (
                  <div key={msg.id}>
                    {showTime && (
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {new Date(msg.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} · {formatMsgTime(msg.created_at)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${isSaida ? "justify-end" : "justify-start"} mb-1`}>
                      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        isSaida
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border rounded-bl-sm"
                      }`}>
                        {msg.ia_gerada && (
                          <div className={`flex items-center gap-1 mb-1 ${isSaida ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            <Bot className="h-3 w-3" />
                            <span className="text-[10px] font-medium">IA SDR</span>
                          </div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.conteudo}</p>
                        <div className={`flex items-center gap-1 mt-1 justify-end ${isSaida ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          <span className="text-[10px]">{formatMsgTime(msg.created_at)}</span>
                          {isSaida && STATUS_MSG[msg.status]}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={msgEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border bg-card px-4 py-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-h-[40px] max-h-[120px] relative">
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
                  placeholder="Digite uma mensagem… (Enter para enviar)"
                  rows={1}
                  className="w-full h-full min-h-[40px] max-h-[120px] rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  style={{ resize: "none" }}
                />
              </div>
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl shrink-0"
                onClick={sendMsg}
                disabled={!texto.trim() || sendingMsg}
              >
                {sendingMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              {convAtiva.ia_ativa ? (
                <span className="flex items-center justify-center gap-1 text-primary">
                  <Bot className="h-3 w-3" /> IA SDR respondendo automaticamente
                </span>
              ) : "Shift+Enter para nova linha"}
            </p>
          </div>
        </div>
      ) : (
        /* Empty state desktop */
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-base font-semibold mb-2">Selecione uma conversa</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            Escolha uma conversa na lista ou inicie uma nova com um membro ou visitante
          </p>
          <div className="space-y-3 w-full max-w-xs">
            {[
              { icon: <Users className="h-4 w-4" />, label: "Acompanhamento Pastoral", desc: "Verificar como está o irmão", fluxo: "pastoral" },
              { icon: <Heart className="h-4 w-4" />, label: "Visitante", desc: "Agradecer e convidar para retornar", fluxo: "visitante" },
            ].map(({ icon, label, desc }) => (
              <button key={label} onClick={() => setModalAberto(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/30 transition-all text-left">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">{icon}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* uazapi config notice */}
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Configure uazapi e OpenAI em</span>
            <Link href="/admin" className="text-primary hover:underline font-medium">Área Administrativa</Link>
          </div>
        </div>
      )}

      {/* Nova Conversa modal */}
      {modalAberto && (
        <ModalNovaConversa membros={membros} onClose={() => setModalAberto(false)} onCriar={criarConversa} />
      )}
    </div>
  )
}
