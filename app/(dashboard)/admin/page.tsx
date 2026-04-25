"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import {
  Shield, Bot, MessageSquare, Phone, Plus, Trash2, Save,
  Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Bell,
  ChevronRight, Settings2,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface NumeroNotificacao {
  id: string
  nome: string
  telefone: string
  categoria: string // casamento, financeiro, geral, pastoral, etc.
}

interface Config {
  openai_api_key: string
  openai_model: string
  uazapi_token: string
  uazapi_instance: string
  uazapi_base_url: string
  sdr_nome: string
  sdr_apresentacao: string
  numeros_notificacao: NumeroNotificacao[]
}

const CATEGORIAS_NOTIFICACAO = [
  { value: "geral",      label: "Geral",           icon: "📢" },
  { value: "pastoral",   label: "Pastoral",         icon: "✝️" },
  { value: "financeiro", label: "Financeiro",       icon: "💰" },
  { value: "casamento",  label: "Casamento",        icon: "💍" },
  { value: "saude",      label: "Saúde",            icon: "🏥" },
  { value: "jovens",     label: "Jovens/Células",   icon: "👥" },
]

const DEFAULT_CONFIG: Config = {
  openai_api_key: "",
  openai_model: "gpt-4o-mini",
  uazapi_token: "",
  uazapi_instance: "",
  uazapi_base_url: "https://api.uazapi.io",
  sdr_nome: "Assistente Missionária Virtual",
  sdr_apresentacao: "Olá! Sou a assistente virtual da nossa igreja. Estou aqui para ajudar e me conectar com você. 😊",
  numeros_notificacao: [],
}

// ─── Tab components ───────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-card text-foreground shadow-sm border border-border"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function SectionCard({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { toast } = useToast()
  const [tab, setTab]       = useState<"ia" | "whatsapp" | "sdr" | "notificacoes">("ia")
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showUazapiToken, setShowUazapiToken] = useState(false)
  const [testingUazapi, setTestingUazapi] = useState(false)
  const [uazapiStatus, setUazapiStatus] = useState<"idle" | "ok" | "error">("idle")
  const [novoNumero, setNovoNumero] = useState({ nome: "", telefone: "", categoria: "geral" })
  const [igrejaId, setIgrejaId] = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase as any).from("profiles").select("igreja_id").eq("id", user.id).single()
        .then(async ({ data }: any) => {
          if (!data?.igreja_id) { setLoading(false); return }
          setIgrejaId(data.igreja_id)
          // Load saved config from church record
          const { data: ig } = await (supabase as any).from("igrejas").select("configuracoes").eq("id", data.igreja_id).single()
          if (ig?.configuracoes) {
            setConfig(prev => ({ ...prev, ...ig.configuracoes }))
          }
          setLoading(false)
        })
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await (supabase as any).from("igrejas").update({ configuracoes: config }).eq("id", igrejaId)
      if (error) throw error
      toast({ title: "Configurações salvas!" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally { setSaving(false) }
  }

  async function testUazapi() {
    setTestingUazapi(true)
    setUazapiStatus("idle")
    try {
      const res = await fetch("/api/admin/test-uazapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: config.uazapi_token, instance: config.uazapi_instance, base_url: config.uazapi_base_url }),
      })
      if (res.ok) { setUazapiStatus("ok"); toast({ title: "uazapi conectada com sucesso!" }) }
      else { setUazapiStatus("error"); toast({ variant: "destructive", title: "Falha na conexão com uazapi" }) }
    } catch { setUazapiStatus("error"); toast({ variant: "destructive", title: "Erro ao testar uazapi" }) }
    finally { setTestingUazapi(false) }
  }

  function addNumero() {
    if (!novoNumero.nome || !novoNumero.telefone) {
      toast({ variant: "destructive", title: "Preencha nome e telefone" })
      return
    }
    const id = `n-${Date.now()}`
    setConfig(c => ({ ...c, numeros_notificacao: [...(c.numeros_notificacao ?? []), { ...novoNumero, id }] }))
    setNovoNumero({ nome: "", telefone: "", categoria: "geral" })
  }

  function removeNumero(id: string) {
    setConfig(c => ({ ...c, numeros_notificacao: c.numeros_notificacao.filter(n => n.id !== id) }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Área Administrativa</h1>
          </div>
          <p className="text-sm text-muted-foreground">Configure integrações, IA e canais de comunicação do sistema</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl w-fit">
        <TabButton active={tab === "ia"} onClick={() => setTab("ia")} icon={<Bot className="h-4 w-4" />} label="Inteligência Artificial" />
        <TabButton active={tab === "whatsapp"} onClick={() => setTab("whatsapp")} icon={<MessageSquare className="h-4 w-4" />} label="WhatsApp / uazapi" />
        <TabButton active={tab === "sdr"} onClick={() => setTab("sdr")} icon={<Settings2 className="h-4 w-4" />} label="SDR Config" />
        <TabButton active={tab === "notificacoes"} onClick={() => setTab("notificacoes")} icon={<Bell className="h-4 w-4" />} label="Notificações" />
      </div>

      {/* ── Tab: IA ── */}
      {tab === "ia" && (
        <div className="space-y-4">
          <SectionCard
            title="OpenAI"
            description="Configure a API do ChatGPT para alimentar a IA SDR"
            icon={<Bot className="h-4 w-4 text-primary" />}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Chave da API (OpenAI) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showOpenAIKey ? "text" : "password"}
                    value={config.openai_api_key}
                    onChange={e => setConfig(c => ({ ...c, openai_api_key: e.target.value }))}
                    placeholder="sk-proj-..."
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenAIKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Acesse platform.openai.com para gerar sua chave</p>
              </div>

              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <select
                  value={config.openai_model}
                  onChange={e => setConfig(c => ({ ...c, openai_model: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini (recomendado — rápido e econômico)</option>
                  <option value="gpt-4o">GPT-4o (mais inteligente)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (mais barato)</option>
                </select>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  A chave da API é armazenada de forma segura e utilizada exclusivamente para a IA SDR da sua igreja. Ela não é compartilhada com terceiros.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Tab: WhatsApp ── */}
      {tab === "whatsapp" && (
        <div className="space-y-4">
          <SectionCard
            title="uazapi — WhatsApp API"
            description="Conecte sua instância do WhatsApp via uazapi para envio de mensagens"
            icon={<MessageSquare className="h-4 w-4 text-primary" />}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>URL Base da API</Label>
                <Input
                  value={config.uazapi_base_url}
                  onChange={e => setConfig(c => ({ ...c, uazapi_base_url: e.target.value }))}
                  placeholder="https://api.uazapi.io"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Nome da Instância <span className="text-destructive">*</span></Label>
                <Input
                  value={config.uazapi_instance}
                  onChange={e => setConfig(c => ({ ...c, uazapi_instance: e.target.value }))}
                  placeholder="minha-igreja"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Token de Autenticação <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showUazapiToken ? "text" : "password"}
                    value={config.uazapi_token}
                    onChange={e => setConfig(c => ({ ...c, uazapi_token: e.target.value }))}
                    placeholder="eyJ..."
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUazapiToken(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showUazapiToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={testUazapi}
                  disabled={testingUazapi || !config.uazapi_token || !config.uazapi_instance}
                  className="gap-2"
                >
                  {testingUazapi ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  Testar Conexão
                </Button>
                {uazapiStatus === "ok" && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Conectado
                  </span>
                )}
                {uazapiStatus === "error" && (
                  <span className="flex items-center gap-1.5 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" /> Falha na conexão
                  </span>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Tab: SDR Config ── */}
      {tab === "sdr" && (
        <div className="space-y-4">
          <SectionCard
            title="Identidade da Assistente SDR"
            description="Configure como a IA se apresenta aos membros e visitantes"
            icon={<Bot className="h-4 w-4 text-primary" />}
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome da Assistente</Label>
                <Input
                  value={config.sdr_nome}
                  onChange={e => setConfig(c => ({ ...c, sdr_nome: e.target.value }))}
                  placeholder="Ex: Assistente Missionária Virtual"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Mensagem de apresentação</Label>
                <textarea
                  value={config.sdr_apresentacao}
                  onChange={e => setConfig(c => ({ ...c, sdr_apresentacao: e.target.value }))}
                  rows={4}
                  placeholder="Olá! Sou a assistente virtual da nossa igreja..."
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <p className="text-xs text-muted-foreground">Esta é a mensagem que será enviada ao iniciar uma nova conversa</p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fluxos ativos</p>
                {[
                  { label: "Confirmação de Escala",   desc: "Pergunta disponibilidade ao escalado e registra recusa",  active: true },
                  { label: "Acompanhamento Pastoral", desc: "Verifica como está o membro e oferece suporte",           active: true },
                  { label: "Boas-vindas a Visitante", desc: "Agradece presença e pergunta avaliação",                  active: true },
                  { label: "Follow-up de Decisão",    desc: "Acompanha novos convertidos/batizados",                   active: false },
                ].map(({ label, desc, active }) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2 border-t border-border first:border-0">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {active ? "Ativo" : "Em breve"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Tab: Notificações ── */}
      {tab === "notificacoes" && (
        <div className="space-y-4">
          <SectionCard
            title="Números de Notificação"
            description="Configure até 10+ números por categoria para receber alertas da IA SDR"
            icon={<Phone className="h-4 w-4 text-primary" />}
          >
            <div className="space-y-4">
              {/* Add form */}
              <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adicionar número</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome / Cargo</Label>
                    <Input
                      value={novoNumero.nome}
                      onChange={e => setNovoNumero(n => ({ ...n, nome: e.target.value }))}
                      placeholder="Pastor João"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">WhatsApp</Label>
                    <Input
                      value={novoNumero.telefone}
                      onChange={e => setNovoNumero(n => ({ ...n, telefone: e.target.value }))}
                      placeholder="5511999999999"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Categoria</Label>
                    <select
                      value={novoNumero.categoria}
                      onChange={e => setNovoNumero(n => ({ ...n, categoria: e.target.value }))}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {CATEGORIAS_NOTIFICACAO.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={addNumero} className="gap-2">
                  <Plus className="h-4 w-4" /> Adicionar Número
                </Button>
              </div>

              {/* List */}
              {(config.numeros_notificacao ?? []).length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum número cadastrado ainda</p>
                  <p className="text-xs mt-1">Adicione números acima para receber notificações da IA</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Group by category */}
                  {CATEGORIAS_NOTIFICACAO.map(cat => {
                    const numeros = (config.numeros_notificacao ?? []).filter(n => n.categoria === cat.value)
                    if (numeros.length === 0) return null
                    return (
                      <div key={cat.value}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <span>{cat.icon}</span> {cat.label}
                        </p>
                        {numeros.map(n => (
                          <div key={n.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5 mb-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{n.nome}</p>
                              <p className="text-xs text-muted-foreground font-mono">{n.telefone}</p>
                            </div>
                            <button
                              onClick={() => removeNumero(n.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-start gap-3 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>A IA enviará notificações baseadas na categoria:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><strong>Geral:</strong> recebe todos os alertas</li>
                    <li><strong>Pastoral:</strong> membro com dificuldades espirituais/emocionais</li>
                    <li><strong>Financeiro:</strong> necessidade de ajuda financeira</li>
                    <li><strong>Casamento:</strong> problemas no relacionamento conjugal</li>
                  </ul>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Save footer */}
      <div className="flex justify-end pt-2 border-t border-border">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  )
}
