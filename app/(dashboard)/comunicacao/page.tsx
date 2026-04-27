"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  MessageSquare, Search, Plus, Send, Bot, Sparkles, UserCheck,
  Users, Heart, Eye, ChevronDown, X, Phone, Loader2, AlertCircle,
  CheckCheck, Check, Clock, Wifi, WifiOff, RefreshCw, MoreVertical,
  Paperclip, Mic, MicOff, Image, FileText, Video, Info, PanelRight,
  StickyNote, Save, User, Tag,
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
  foto_url?: string | null
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

// ─── Avatar com foto ou iniciais ─────────────────────────────────────────────

function ContatoAvatar({ nome, foto, size = "md", iaAtiva = false }: { nome: string; foto?: string | null; size?: "sm"|"md"|"lg"; iaAtiva?: boolean }) {
  const sz = size === "sm" ? "h-8 w-8 text-[10px]" : size === "lg" ? "h-12 w-12 text-sm" : "h-10 w-10 text-sm"
  return (
    <div className="relative shrink-0">
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt={nome} className={`${sz} rounded-full object-cover`} onError={e => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.removeAttribute("style") }} />
      ) : null}
      <div
        className={`${sz} rounded-full flex items-center justify-center text-white font-bold ${foto ? "hidden" : ""}`}
        style={{ backgroundColor: avatarColor(nome || "?") }}
      >
        {getInitials(nome || "?")}
      </div>
      {iaAtiva && (
        <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-card flex items-center justify-center ring-1 ring-border">
          <Bot className="h-2.5 w-2.5 text-primary" />
        </span>
      )}
    </div>
  )
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
  const [painelInfo, setPainelInfo] = useState(false)
  const [anotacao, setAnotacao]     = useState("")
  const [savingAnotacao, setSavingAnotacao] = useState(false)
  // Áudio
  const [gravando, setGravando]     = useState(false)
  const [tempoGravacao, setTempoGravacao] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const timerRef         = useRef<NodeJS.Timeout | null>(null)
  // Upload
  const [uploading, setUploading]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const msgEndRef    = useRef<HTMLDivElement>(null)

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

    // Auto-refresh a cada 20s (silent — não pisca)
    const interval = setInterval(() => fetchConversas(true), 20000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchConversas(silent = false) {
    if (!silent) setLoadingConv(true)
    try {
      const res = await fetch("/api/comunicacao/conversas")
      const json = await res.json()
      const novas = json.data ?? []
      setConversas(prev => {
        // Só re-render se mudou algo
        if (silent && JSON.stringify(prev.map((c: Conversa) => c.id + c.nao_lidas + c.ultima_msg_at)) ===
            JSON.stringify(novas.map((c: Conversa) => c.id + c.nao_lidas + c.ultima_msg_at))) return prev
        return novas
      })
    } catch { if (!silent) toast({ variant: "destructive", title: "Erro ao carregar conversas" }) }
    finally { if (!silent) setLoadingConv(false) }
  }

  async function fetchMensagens(convId: string, background = false) {
    if (!convId) return
    if (!background) { setLoadingMsg(true); setMensagens([]) }
    try {
      const res = await fetch(`/api/comunicacao/mensagens?conversa_id=${convId}`)
      if (!res.ok) { if (!background) setLoadingMsg(false); return }
      const json = await res.json()
      const novas: Mensagem[] = json.data ?? []
      setMensagens(prev => {
        if (background && prev.length === novas.length &&
            prev[prev.length - 1]?.id === novas[novas.length - 1]?.id) return prev
        return novas
      })
    } catch {
      if (!background) toast({ variant: "destructive", title: "Erro ao carregar mensagens" })
    } finally { if (!background) setLoadingMsg(false) }
  }

  useEffect(() => {
    if (!convAtiva?.id) return
    const id = convAtiva.id
    fetchMensagens(id, false)
    // Background refresh a cada 15s — sem piscar
    const interval = setInterval(() => fetchMensagens(id, true), 15000)
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
        await fetchMensagens(convAtiva.id)
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

  // ── Upload de arquivo ──────────────────────────────────────────────────────
  async function uploadAndSend(file: File) {
    if (!convAtiva) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const upRes  = await fetch("/api/comunicacao/upload", { method: "POST", body: fd })
      const upJson = await upRes.json()
      if (!upRes.ok) throw new Error(upJson.error)

      const tipo = file.type.startsWith("image/") ? "imagem"
        : file.type.startsWith("video/") ? "video"
        : file.type.startsWith("audio/") ? "audio"
        : "documento"

      const res = await fetch("/api/comunicacao/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversa_id: convAtiva.id, conteudo: file.name, tipo, media_url: upJson.url, doc_name: file.name }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setMensagens(prev => [...prev, json.data])
      if (json.sendError) toast({ variant: "destructive", title: "Salvo, mas falhou no WhatsApp", description: json.sendError })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no upload", description: e.message })
    } finally { setUploading(false) }
  }

  // ── Gravação de áudio ──────────────────────────────────────────────────────
  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      audioChunksRef.current   = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: "audio/webm" })
        await uploadAndSend(file)
        setTempoGravacao(0)
      }
      mr.start()
      setGravando(true)
      timerRef.current = setInterval(() => setTempoGravacao(t => t + 1), 1000)
    } catch {
      toast({ variant: "destructive", title: "Microfone não disponível" })
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setGravando(false)
  }

  // ── Salvar anotação ──────────────────────────────────────────────────────
  async function salvarAnotacao() {
    if (!convAtiva || !anotacao.trim()) return
    setSavingAnotacao(true)
    try {
      const supabase = createClient()
      await (supabase as any).from("conversas_whatsapp")
        .update({ resumo_ia: anotacao.trim() }).eq("id", convAtiva.id)
      setConvAtiva(prev => prev ? { ...prev, resumo_ia: anotacao.trim() } : prev)
      toast({ title: "Anotação salva!" })
    } catch {
      toast({ variant: "destructive", title: "Erro ao salvar anotação" })
    } finally { setSavingAnotacao(false) }
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
            <button onClick={() => fetchConversas(false)} className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Atualizar">
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
                  <ContatoAvatar nome={conv.nome_contato || "?"} foto={conv.foto_url} iaAtiva={conv.ia_ativa} />

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

      {/* ── Chat panel + painel info ── */}
      {convAtiva ? (
        <>
        <div className="flex-1 flex flex-col min-w-0 bg-background">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
            {/* Back (mobile) */}
            <button onClick={() => setConvAtiva(null)} className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>

            {/* Avatar */}
            <ContatoAvatar nome={convAtiva.nome_contato || "?"} foto={convAtiva.foto_url} size="md" />

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
              {/* Painel info */}
              <button onClick={() => { setPainelInfo(v => !v); setAnotacao(convAtiva.resumo_ia || "") }}
                className={`hidden lg:flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors border ${painelInfo ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}
                title="Informações e anotações">
                <PanelRight className="h-3.5 w-3.5" />
              </button>

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
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 bg-muted/20">
            {loadingMsg ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : mensagens.filter(m => !m.conteudo.startsWith("[")).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em <strong>Iniciar SDR</strong> para a IA começar</p>
              </div>
            ) : (
              mensagens
                .filter(m => !m.conteudo.startsWith("["))  // oculta mensagens de sistema
                .map((msg, i, arr) => {
                  const isSaida = msg.direcao === "saida"
                  const prevMsg = arr[i - 1]
                  const showTime = !prevMsg || new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000
                  const isConsecutiva = prevMsg && prevMsg.direcao === msg.direcao

                  return (
                    <div key={msg.id} className={isConsecutiva ? "mt-0.5" : "mt-3"}>
                      {showTime && (
                        <div className="flex justify-center my-4">
                          <span className="text-[10px] text-muted-foreground bg-background border border-border px-3 py-1 rounded-full shadow-sm">
                            {new Date(msg.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {formatMsgTime(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex items-end gap-1.5 ${isSaida ? "justify-end" : "justify-start"}`}>
                        {/* Avatar do contato (só na primeira mensagem consecutiva) */}
                        {!isSaida && !isConsecutiva && (
                          <ContatoAvatar nome={convAtiva.nome_contato || "?"} foto={convAtiva.foto_url} size="sm" />
                        )}
                        {!isSaida && isConsecutiva && <div className="w-7 shrink-0" />}

                        <div className={`max-w-[72%] ${isSaida ? "items-end" : "items-start"} flex flex-col`}>
                          {msg.ia_gerada && !isConsecutiva && isSaida && (
                            <span className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1 mr-1">
                              <Bot className="h-3 w-3" /> IA SDR
                            </span>
                          )}
                          <div className={`px-3.5 py-2 shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isSaida
                              ? "bg-[#dcf8c6] dark:bg-[#005c4b] text-[#111] dark:text-white rounded-2xl rounded-br-sm"
                              : "bg-card border border-border text-foreground rounded-2xl rounded-bl-sm"
                          }`}>
                            {msg.conteudo}
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isSaida ? "justify-end" : "justify-start"}`}>
                            <span className="text-[10px] text-muted-foreground">{formatMsgTime(msg.created_at)}</span>
                            {isSaida && <span className="text-muted-foreground">{STATUS_MSG[msg.status]}</span>}
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
          <div className="shrink-0 border-t border-border bg-card px-3 py-2.5">
            {/* Gravando áudio */}
            {gravando && (
              <div className="flex items-center gap-3 mb-2 px-1">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-600">Gravando… {tempoGravacao}s</span>
                <button onClick={pararGravacao} className="ml-auto text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
                  Parar e enviar
                </button>
              </div>
            )}

            <div className="flex items-end gap-1.5">
              {/* Anexo */}
              <div className="relative">
                <button
                  className="h-9 w-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || gravando}
                  title="Enviar arquivo"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAndSend(f); e.target.value = "" }}
                />
              </div>

              {/* Texto */}
              <div className="flex-1">
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
                  placeholder={gravando ? "Gravando áudio…" : "Mensagem…"}
                  rows={1}
                  disabled={gravando}
                  className="w-full min-h-[38px] max-h-[120px] rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              {/* Microfone */}
              <button
                onClick={gravando ? pararGravacao : iniciarGravacao}
                className={`h-9 w-9 flex items-center justify-center rounded-xl transition-colors ${gravando ? "bg-red-500 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                title={gravando ? "Parar gravação" : "Gravar áudio"}
              >
                {gravando ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              {/* Enviar */}
              <Button
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0"
                onClick={sendMsg}
                disabled={!texto.trim() || sendingMsg || gravando}
              >
                {sendingMsg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {convAtiva.ia_ativa && (
              <p className="text-[10px] text-primary flex items-center justify-center gap-1 mt-1">
                <Bot className="h-3 w-3" /> IA SDR respondendo automaticamente
              </p>
            )}
          </div>
        </div>

        {/* ── Painel lateral: info + anotações ── */}
        {painelInfo && (
          <div className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border bg-card">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Informações
              </p>
              <button onClick={() => setPainelInfo(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Contato */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contato</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <ContatoAvatar nome={convAtiva.nome_contato || "?"} foto={convAtiva.foto_url} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{convAtiva.nome_contato}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {convAtiva.telefone}
                      </p>
                    </div>
                  </div>
                  {fluxoInfo && (
                    <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${fluxoInfo.color}`}>
                      <span>{fluxoInfo.icon}</span> {fluxoInfo.label}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      IA: <span className={convAtiva.ia_ativa ? "text-emerald-600 font-medium" : "text-muted-foreground"}>{convAtiva.ia_ativa ? "Ativa" : "Desativada"}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Anotações SDR */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <StickyNote className="h-3.5 w-3.5" /> Anotações do SDR
                </p>
                <textarea
                  value={anotacao || convAtiva.resumo_ia || ""}
                  onChange={e => setAnotacao(e.target.value)}
                  placeholder="Resumo e observações geradas pelo SDR ou anotações manuais…"
                  rows={6}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <Button
                  size="sm"
                  className="w-full mt-2 gap-2"
                  onClick={salvarAnotacao}
                  disabled={savingAnotacao || !anotacao.trim()}
                >
                  {savingAnotacao ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar anotação
                </Button>
              </div>

              {/* Histórico rápido */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico</p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    {mensagens.filter(m => !m.conteudo.startsWith("[")).length} mensagens trocadas
                  </p>
                  {convAtiva.ultima_msg_at && (
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      Último contato: {new Date(convAtiva.ultima_msg_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        </>
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
