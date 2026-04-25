"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeft, ArrowRight, Save, Camera, Upload, X, Loader2, Search,
  User, MapPin, Church, CheckCircle2,
} from "lucide-react"
import Link from "next/link"

// ─── Constants ────────────────────────────────────────────────────────────────

const FUNCOES_ESCALA = [
  { key: "pregacao", label: "Pregação",   icon: "📖" },
  { key: "oracao",   label: "Oração",     icon: "🙏" },
  { key: "louvor",   label: "Louvor",     icon: "🎵" },
  { key: "som",      label: "Som/Técnica",icon: "🔊" },
  { key: "recepcao", label: "Recepção",   icon: "👋" },
  { key: "midia",    label: "Mídia",      icon: "📸" },
  { key: "infantil", label: "Infantil",   icon: "👶" },
]

const STEPS = [
  { id: "pessoal",     label: "Pessoal",     icon: User },
  { id: "endereco",    label: "Endereço",    icon: MapPin },
  { id: "eclesiastico",label: "Igreja",      icon: Church },
  { id: "funcoes",     label: "Funções",     icon: CheckCircle2 },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface FuncaoItem { funcao: string; nivel: string; ativo: boolean }
interface MembroLookup { id: string; nome: string }
interface MembroFormData {
  nome: string; cpf: string; email: string; telefone: string
  data_nascimento: string; sexo: "M" | "F" | ""; estado_civil: string
  conjuge_id: string; cargo: string; dizimista: boolean
  data_batismo: string; data_entrada: string
  status: "ativo" | "inativo" | "visitante"; observacoes: string; foto_url: string
  rua: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string; cep: string
}

// ─── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, onGo }: { current: number; onGo: (i: number) => void }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const Icon = step.icon
        const done = i < current
        const active = i === current
        return (
          <div key={step.id} className="flex items-center flex-1">
            <button
              type="button"
              onClick={() => { if (done) onGo(i) }}
              disabled={i > current}
              className={`flex flex-col items-center gap-1.5 group ${done ? "cursor-pointer" : i === current ? "cursor-default" : "cursor-not-allowed opacity-40"}`}
            >
              <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done    ? "bg-primary border-primary text-primary-foreground"
                : active ? "bg-card border-primary text-primary shadow-md"
                : "bg-muted border-border text-muted-foreground"
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wide hidden sm:block ${active ? "text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                {step.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 transition-colors ${done ? "bg-primary" : "bg-border"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MembroForm({ initialData, membroId }: { initialData?: Partial<MembroFormData>; membroId?: string }) {
  const router = useRouter()
  const [step, setStep]             = useState(0)
  const [loading, setLoading]       = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [membrosLookup, setMembrosLookup] = useState<MembroLookup[]>([])
  const [conjugeSearch, setConjugeSearch] = useState("")
  const [conjugeNome, setConjugeNome]   = useState("")
  const [showConjugeDrop, setShowConjugeDrop] = useState(false)
  const videoRef    = useRef<HTMLVideoElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [funcoes, setFuncoes] = useState<FuncaoItem[]>([])

  useEffect(() => {
    if (!membroId) return
    fetch(`/api/membros/${membroId}`).then(r => r.json())
      .then(d => { if (d.data?.membros_funcoes) setFuncoes(d.data.membros_funcoes) }).catch(() => {})
  }, [membroId])

  function toggleFuncao(funcao: string) {
    setFuncoes(prev => prev.find(f => f.funcao === funcao)
      ? prev.filter(f => f.funcao !== funcao)
      : [...prev, { funcao, nivel: "intermediario", ativo: true }])
  }
  function setNivel(funcao: string, nivel: string) {
    setFuncoes(prev => prev.map(f => f.funcao === funcao ? { ...f, nivel } : f))
  }

  const [formData, setFormData] = useState<MembroFormData>({
    nome: "", cpf: "", email: "", telefone: "",
    data_nascimento: "", sexo: "", estado_civil: "", conjuge_id: "",
    cargo: "", dizimista: false, data_batismo: "",
    data_entrada: new Date().toISOString().split("T")[0],
    status: "ativo", observacoes: "", foto_url: "",
    rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "",
    ...initialData,
  })

  useEffect(() => {
    fetch("/api/membros?pageSize=200").then(r => r.json())
      .then(d => setMembrosLookup((d.data ?? []).filter((m: any) => m.id !== membroId))).catch(() => {})
  }, [membroId])

  const conjugeFiltrado = membrosLookup.filter(m => m.nome.toLowerCase().includes(conjugeSearch.toLowerCase())).slice(0, 8)

  function setField(name: string, value: any) {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    setField(name, type === "checkbox" ? (e.target as HTMLInputElement).checked : value)
  }

  // ── Photo ──
  async function uploadFoto(file: File) {
    setUploadingFoto(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (membroId) fd.append("membroId", membroId)
      const res  = await fetch("/api/membros/upload-foto", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setField("foto_url", data.foto_url)
    } catch (e: any) { alert(e.message) } finally { setUploadingFoto(false) }
  }

  async function openCamera() {
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch { alert("Não foi possível acessar a câmera"); setCameraOpen(false) }
  }

  async function capturePhoto() {
    if (!videoRef.current) return
    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0)
    canvas.toBlob(async blob => {
      if (!blob) return
      closeCamera()
      await uploadFoto(new File([blob], "foto.jpg", { type: "image/jpeg" }))
    }, "image/jpeg", 0.9)
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  // ── Submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        nome: formData.nome, cpf: formData.cpf || null, email: formData.email || null,
        telefone: formData.telefone || null, data_nascimento: formData.data_nascimento || null,
        sexo: formData.sexo || null, estado_civil: formData.estado_civil || null,
        conjuge_id: formData.conjuge_id || null, cargo: formData.cargo || null,
        dizimista: formData.dizimista, data_batismo: formData.data_batismo || null,
        data_entrada: formData.data_entrada, status: formData.status,
        observacoes: formData.observacoes || null, foto_url: formData.foto_url || null,
        endereco: formData.rua
          ? { rua: formData.rua, numero: formData.numero, complemento: formData.complemento, bairro: formData.bairro, cidade: formData.cidade, estado: formData.estado, cep: formData.cep }
          : null,
        funcoes,
      }
      const url    = membroId ? `/api/membros/${membroId}` : "/api/membros"
      const method = membroId ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao salvar") }
      router.push("/membros"); router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar membro")
    } finally { setLoading(false) }
  }

  const isLastStep = step === STEPS.length - 1

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Camera modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-background rounded-2xl overflow-hidden max-w-sm w-full">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-square object-cover" />
            <div className="flex gap-3 p-4">
              <Button className="flex-1" onClick={capturePhoto}><Camera className="mr-2 h-4 w-4" /> Tirar Foto</Button>
              <Button variant="outline" onClick={closeCamera}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {/* Back link */}
        <div className="mb-6">
          <Link href="/membros">
            <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Membros
            </Button>
          </Link>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} onGo={setStep} />

        {/* ── Step card ── */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">

          {/* ── Step 0: Pessoal ── */}
          {step === 0 && (
            <Section title="Dados Pessoais" description="Informações básicas de identificação do membro">

              {/* Foto */}
              <div className="flex items-center gap-5 p-4 rounded-xl bg-muted/50 border border-border">
                <div className="h-20 w-20 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {uploadingFoto ? (
                    <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  ) : formData.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={formData.foto_url} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Foto do membro</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" className="gap-2 h-8" onClick={() => fileInputRef.current?.click()} disabled={uploadingFoto}>
                      <Upload className="h-3.5 w-3.5" /> Arquivo
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="gap-2 h-8" onClick={openCamera} disabled={uploadingFoto}>
                      <Camera className="h-3.5 w-3.5" /> Câmera
                    </Button>
                    {formData.foto_url && (
                      <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setField("foto_url", "")}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP · máx. 3MB</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f); e.target.value = "" }} />
              </div>

              <FieldRow>
                <Field label="Nome Completo" required>
                  <Input name="nome" value={formData.nome} onChange={handleChange} required placeholder="Nome completo do membro" />
                </Field>
                <Field label="CPF">
                  <Input name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" />
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="E-mail">
                  <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@exemplo.com" />
                </Field>
                <Field label="Telefone / WhatsApp">
                  <Input name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 00000-0000" />
                </Field>
              </FieldRow>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Data de Nascimento">
                  <Input name="data_nascimento" type="date" value={formData.data_nascimento} onChange={handleChange} />
                </Field>
                <Field label="Sexo">
                  <select name="sexo" value={formData.sexo} onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Selecione…</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </Field>
                <Field label="Estado Civil">
                  <select name="estado_civil" value={formData.estado_civil} onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Selecione…</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                  </select>
                </Field>
              </div>

              {/* Cônjuge */}
              {formData.estado_civil === "casado" && (
                <Field label="Cônjuge (membro desta igreja)">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={conjugeNome || conjugeSearch}
                      onChange={e => { setConjugeSearch(e.target.value); setConjugeNome(""); setField("conjuge_id", ""); setShowConjugeDrop(true) }}
                      onFocus={() => setShowConjugeDrop(true)}
                      placeholder="Buscar membro…"
                      className="pl-9"
                    />
                    {formData.conjuge_id && (
                      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => { setField("conjuge_id", ""); setConjugeNome(""); setConjugeSearch("") }}>
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {showConjugeDrop && conjugeSearch && !formData.conjuge_id && (
                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-y-auto">
                      {conjugeFiltrado.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum encontrado</p>
                      ) : conjugeFiltrado.map(m => (
                        <button key={m.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => { setField("conjuge_id", m.id); setConjugeNome(m.nome); setConjugeSearch(""); setShowConjugeDrop(false) }}>
                          {m.nome}
                        </button>
                      ))}
                      <button type="button" className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted border-t"
                        onClick={() => { setShowConjugeDrop(false); setConjugeSearch("") }}>
                        Não é membro desta igreja
                      </button>
                    </div>
                  )}
                </Field>
              )}
            </Section>
          )}

          {/* ── Step 1: Endereço ── */}
          {step === 1 && (
            <Section title="Endereço" description="Localização residencial do membro">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="Rua / Avenida">
                    <Input name="rua" value={formData.rua} onChange={handleChange} placeholder="Nome da rua ou avenida" />
                  </Field>
                </div>
                <Field label="Número">
                  <Input name="numero" value={formData.numero} onChange={handleChange} placeholder="Nº" />
                </Field>
              </div>
              <FieldRow>
                <Field label="Complemento">
                  <Input name="complemento" value={formData.complemento} onChange={handleChange} placeholder="Apto, Bloco, Casa…" />
                </Field>
                <Field label="Bairro">
                  <Input name="bairro" value={formData.bairro} onChange={handleChange} />
                </Field>
              </FieldRow>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Cidade">
                  <Input name="cidade" value={formData.cidade} onChange={handleChange} />
                </Field>
                <Field label="Estado (UF)">
                  <Input name="estado" value={formData.estado} onChange={handleChange} placeholder="SP" maxLength={2} />
                </Field>
                <Field label="CEP">
                  <Input name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" />
                </Field>
              </div>
            </Section>
          )}

          {/* ── Step 2: Eclesiástico ── */}
          {step === 2 && (
            <Section title="Dados Eclesiásticos" description="Informações sobre a vida e participação na igreja">
              <FieldRow>
                <Field label="Cargo / Função na Igreja">
                  <Input name="cargo" value={formData.cargo} onChange={handleChange} placeholder="Ex: Diácono, Líder de Louvor…" />
                </Field>
                <Field label="Status" required>
                  <select name="status" value={formData.status} onChange={handleChange} required
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="visitante">Visitante</option>
                  </select>
                </Field>
              </FieldRow>
              <FieldRow>
                <Field label="Data de Entrada" required>
                  <Input name="data_entrada" type="date" value={formData.data_entrada} onChange={handleChange} required />
                </Field>
                <Field label="Data de Batismo">
                  <Input name="data_batismo" type="date" value={formData.data_batismo} onChange={handleChange} />
                </Field>
              </FieldRow>

              {/* Dizimista toggle */}
              <div className={`flex items-center justify-between rounded-xl p-4 border-2 cursor-pointer transition-colors ${formData.dizimista ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}
                onClick={() => setField("dizimista", !formData.dizimista)}>
                <div>
                  <p className="text-sm font-semibold">Dizimista</p>
                  <p className="text-xs text-muted-foreground">Este membro contribui regularmente com o dízimo</p>
                </div>
                <div className={`h-6 w-11 rounded-full relative transition-colors ${formData.dizimista ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${formData.dizimista ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </div>

              <Field label="Observações">
                <textarea name="observacoes" value={formData.observacoes} onChange={handleChange} rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Informações adicionais, histórico, necessidades especiais…" />
              </Field>
            </Section>
          )}

          {/* ── Step 3: Funções ── */}
          {step === 3 && (
            <Section title="Funções na Escala" description="Selecione as funções que este membro pode exercer nos cultos e seu nível">
              <div className="grid gap-3 sm:grid-cols-2">
                {FUNCOES_ESCALA.map(({ key, label, icon }) => {
                  const ativo = funcoes.find(f => f.funcao === key)
                  return (
                    <div key={key}
                      className={`rounded-xl border-2 transition-all ${ativo ? "border-primary/40 bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleFuncao(key)}>
                        <span className="text-lg shrink-0">{icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{label}</p>
                          {ativo && <p className="text-xs text-primary font-medium">Ativo</p>}
                        </div>
                        <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${ativo ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                          {ativo && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                      {ativo && (
                        <div className="px-4 pb-3 pt-0 flex items-center gap-2">
                          <p className="text-xs text-muted-foreground shrink-0">Nível:</p>
                          <select value={ativo.nivel} onChange={e => setNivel(key, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="flex-1 h-7 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                            <option value="iniciante">Iniciante</option>
                            <option value="intermediario">Intermediário</option>
                            <option value="avancado">Avançado</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {funcoes.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  Nenhuma função selecionada. O membro poderá ser atribuído manualmente nas escalas.
                </p>
              )}
            </Section>
          )}
        </div>

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between mt-5">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => step > 0 ? setStep(s => s - 1) : router.push("/membros")}
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 0 ? "Cancelar" : "Anterior"}
          </Button>

          {isLastStep ? (
            <Button type="submit" disabled={loading} className="gap-2 min-w-[140px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {loading ? "Salvando…" : membroId ? "Salvar Alterações" : "Cadastrar Membro"}
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                if (step === 0 && !formData.nome) { alert("Informe o nome do membro para continuar."); return }
                setStep(s => s + 1)
              }}
            >
              Próximo <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </>
  )
}
