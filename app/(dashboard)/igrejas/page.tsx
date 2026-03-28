"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, Plus, Pencil, Trash2, Loader2, X, AlertTriangle, Clock, Upload } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

const DIAS_SEMANA = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"]

interface CultoRegular {
  id?: string
  nome: string
  dia_semana: number
  horario: string
  tipo: string
}

interface Igreja {
  id: string
  nome: string
  tipo: "sede" | "congregacao"
  telefone?: string
  email?: string
  endereco?: { rua?: string; cidade?: string; estado?: string }
  logo_url?: string | null
  cultos?: CultoRegular[]
}

interface IgrejaForm {
  nome: string
  tipo: "sede" | "congregacao"
  telefone: string
  email: string
  endereco: { rua: string; cidade: string; estado: string }
}

const EMPTY_FORM: IgrejaForm = {
  nome: "", tipo: "congregacao",
  telefone: "", email: "",
  endereco: { rua: "", cidade: "", estado: "" },
}

const EMPTY_CULTO: CultoRegular = { nome: "", dia_semana: 0, horario: "19:00", tipo: "semana" }

export default function IgrejasPage() {
  const { toast } = useToast()
  const [igrejas, setIgrejas] = useState<Igreja[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Igreja | null>(null)
  const [form, setForm] = useState<IgrejaForm>(EMPTY_FORM)
  const [cultos, setCultos] = useState<CultoRegular[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Igreja | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)

  useEffect(() => { fetchIgrejas() }, [])

  async function fetchIgrejas() {
    setLoading(true)
    try {
      const res = await fetch("/api/igrejas")
      const json = await res.json()
      setIgrejas(json.data ?? [])
    } catch {
      toast({ variant: "destructive", title: "Erro ao carregar igrejas" })
    } finally {
      setLoading(false)
    }
  }

  async function openEdit(ig: Igreja) {
    setEditing(ig)
    setForm({
      nome: ig.nome, tipo: ig.tipo,
      telefone: ig.telefone ?? "", email: ig.email ?? "",
      endereco: { rua: ig.endereco?.rua ?? "", cidade: ig.endereco?.cidade ?? "", estado: ig.endereco?.estado ?? "" },
    })
    setLogoUrl(ig.logo_url ?? null)
    setPendingLogoFile(null)
    // Fetch cultos regulares
    try {
      const res = await fetch(`/api/igrejas/cultos-regulares?igreja_id=${ig.id}`)
      const json = await res.json()
      setCultos(json.data ?? [])
    } catch {
      setCultos([])
    }
    setModalOpen(true)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setCultos([])
    setLogoUrl(null)
    setPendingLogoFile(null)
    setModalOpen(true)
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Preview immediately
    setLogoUrl(URL.createObjectURL(file))
    setPendingLogoFile(file)
  }

  function addCulto() {
    setCultos(prev => [...prev, { ...EMPTY_CULTO }])
  }

  function removeCulto(idx: number) {
    setCultos(prev => prev.filter((_, i) => i !== idx))
  }

  function updateCulto(idx: number, field: keyof CultoRegular, value: string | number) {
    setCultos(prev => prev.map((c, i) => {
      if (i !== idx) return c
      // Auto-fill nome when dia_semana changes if nome is empty or was auto-generated
      if (field === "dia_semana") {
        const dow = Number(value)
        const autoNome = dow === 0 ? "Culto de Domingo" : `Culto de ${DIAS_SEMANA[dow]}`
        return { ...c, dia_semana: dow, nome: c.nome || autoNome }
      }
      return { ...c, [field]: value }
    }))
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast({ variant: "destructive", title: "Nome é obrigatório" }); return
    }
    for (const c of cultos) {
      if (!c.horario) {
        toast({ variant: "destructive", title: "Preencha o horário de todos os cultos" }); return
      }
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        telefone: form.telefone || null,
        email: form.email || null,
        endereco: (form.endereco?.rua || form.endereco?.cidade) ? form.endereco : null,
      }

      const res = await fetch("/api/igrejas", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      const igId = editing?.id ?? json.data?.id
      if (igId) {
        await fetch("/api/igrejas/cultos-regulares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ igreja_id: igId, cultos }),
        })
        // Upload logo if a new file was selected
        if (pendingLogoFile) {
          setUploadingLogo(true)
          const fd = new FormData()
          fd.append("file", pendingLogoFile)
          fd.append("igrejaId", igId)
          const logoRes = await fetch("/api/igrejas/upload-logo", { method: "POST", body: fd })
          const logoJson = await logoRes.json()
          setUploadingLogo(false)
          setPendingLogoFile(null)
          if (!logoRes.ok) throw new Error(logoJson.error || "Erro ao fazer upload do logo")
          setLogoUrl(logoJson.logo_url)
        }
      }

      toast({ title: editing ? "Igreja atualizada!" : "Igreja cadastrada!" })
      setModalOpen(false)
      fetchIgrejas()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch("/api/igrejas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast({ title: "Igreja removida." })
      setDeleteTarget(null)
      fetchIgrejas()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao deletar", description: e.message })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Igrejas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {igrejas.length} igreja{igrejas.length !== 1 ? "s" : ""} cadastrada{igrejas.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Igreja
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : igrejas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-20 text-center">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">Nenhuma igreja cadastrada</p>
          <p className="text-xs text-muted-foreground mb-4">Cadastre a primeira igreja para começar.</p>
          <Button size="sm" onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" /> Cadastrar Igreja
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {igrejas.map((ig) => (
            <div key={ig.id} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {ig.logo_url ? (
                    <img src={ig.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">{ig.nome}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{ig.tipo}</p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                {ig.telefone && <p>{ig.telefone}</p>}
                {ig.email && <p>{ig.email}</p>}
                {ig.endereco?.cidade && (
                  <p>{ig.endereco.cidade}{ig.endereco.estado ? `, ${ig.endereco.estado}` : ""}</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border mt-auto">
                <button
                  onClick={() => openEdit(ig)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button
                  onClick={() => setDeleteTarget(ig)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-sm">Remover igreja?</DialogTitle>
                <p className="text-xs text-muted-foreground truncate max-w-[220px] mt-0.5">{deleteTarget?.nome}</p>
              </div>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Todos os dados desta igreja (membros, escalas, financeiro) podem ser afetados. Esta ação é irreversível.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) setModalOpen(false) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle>{editing ? "Editar Igreja" : "Nova Igreja"}</DialogTitle>
          </DialogHeader>

          {/* Modal body */}
          <div className="overflow-y-auto p-6 space-y-6 flex-1">

              {/* Logo */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-7 w-7 text-muted-foreground/50" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Logo da Igreja</p>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                    {uploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {logoUrl ? "Trocar logo" : "Fazer upload"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="sr-only" onChange={handleLogoChange} />
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP ou SVG. Máx 2MB.</p>
                </div>
              </div>

              {/* Dados básicos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados da Igreja</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Igreja Pentecostal Vale da Bênção" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      value={form.tipo}
                      onChange={e => setForm(f => ({ ...f, tipo: e.target.value as "sede" | "congregacao" }))}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="sede">Sede</option>
                      <option value="congregacao">Congregação</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">E-mail</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@ipvb.com" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs">Endereço</Label>
                    <Input value={form.endereco.rua} onChange={e => setForm(f => ({ ...f, endereco: { ...f.endereco, rua: e.target.value } }))} placeholder="Rua, número, bairro" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={form.endereco.cidade} onChange={e => setForm(f => ({ ...f, endereco: { ...f.endereco, cidade: e.target.value } }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estado (UF)</Label>
                    <Input value={form.endereco.estado} onChange={e => setForm(f => ({ ...f, endereco: { ...f.endereco, estado: e.target.value } }))} placeholder="SP" maxLength={2} />
                  </div>
                </div>
              </div>

              {/* Dias de Culto */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dias de Culto</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Usados para gerar as escalas automaticamente</p>
                  </div>
                  <button
                    onClick={addCulto}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>

                {cultos.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-center">
                    <Clock className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">Nenhum culto cadastrado.</p>
                    <button onClick={addCulto} className="mt-1.5 text-xs text-primary hover:underline">+ Adicionar culto</button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cultos.map((c, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center bg-muted/40 rounded-lg px-3 py-2">
                        <select
                          value={c.dia_semana}
                          onChange={e => updateCulto(idx, "dia_semana", Number(e.target.value))}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {DIAS_SEMANA.map((d, i) => (
                            <option key={i} value={i}>{d}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={c.horario}
                          onChange={e => updateCulto(idx, "horario", e.target.value)}
                          className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
                        />
                        <Input
                          value={c.nome}
                          onChange={e => updateCulto(idx, "nome", e.target.value)}
                          placeholder="Nome (ex: Domingo Manhã)"
                          className="h-8 text-sm w-44"
                        />
                        <button
                          onClick={() => removeCulto(idx)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
