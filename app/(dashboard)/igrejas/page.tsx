"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Church, Plus, Pencil, Loader2, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Igreja {
  id: string
  nome: string
  tipo: "sede" | "congregacao"
  telefone?: string
  email?: string
  endereco?: { rua?: string; cidade?: string; estado?: string }
}

const EMPTY: Omit<Igreja, "id"> = {
  nome: "",
  tipo: "congregacao",
  telefone: "",
  email: "",
  endereco: { rua: "", cidade: "", estado: "" },
}

export default function IgrejasPage() {
  const { toast } = useToast()
  const [igrejas, setIgrejas] = useState<Igreja[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Igreja | null>(null)
  const [form, setForm] = useState<Omit<Igreja, "id">>(EMPTY)

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

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setModalOpen(true)
  }

  function openEdit(ig: Igreja) {
    setEditing(ig)
    setForm({
      nome: ig.nome,
      tipo: ig.tipo,
      telefone: ig.telefone ?? "",
      email: ig.email ?? "",
      endereco: ig.endereco ?? {},
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome) { toast({ variant: "destructive", title: "Nome é obrigatório" }); return }
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

      toast({ title: editing ? "Igreja atualizada!" : "Igreja cadastrada!" })
      setModalOpen(false)
      fetchIgrejas()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Igrejas</h2>
          <p className="text-muted-foreground">Gerencie as igrejas e congregações</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Igreja
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {igrejas.map((ig) => (
            <Card key={ig.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Church className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ig.nome}</CardTitle>
                      <CardDescription className="capitalize">{ig.tipo}</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEdit(ig)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {ig.telefone && <p className="text-muted-foreground">📞 {ig.telefone}</p>}
                  {ig.email && <p className="text-muted-foreground">📧 {ig.email}</p>}
                  {ig.endereco?.cidade && (
                    <p className="text-muted-foreground">📍 {ig.endereco.cidade}{ig.endereco.estado ? ` — ${ig.endereco.estado}` : ""}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {igrejas.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Church className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma igreja cadastrada</h3>
                <Button onClick={openNew} className="mt-2"><Plus className="mr-2 h-4 w-4" />Adicionar Igreja</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Modal criar/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">{editing ? "Editar Igreja" : "Nova Igreja"}</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da igreja" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as "sede" | "congregacao" }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="sede">Sede</option>
                    <option value="congregacao">Congregação</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone ?? ""} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contato@igreja.com" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Rua / Endereço</Label>
                  <Input value={form.endereco?.rua ?? ""} onChange={e => setForm(f => ({ ...f, endereco: { ...f.endereco, rua: e.target.value } }))} placeholder="Rua..." />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={form.endereco?.cidade ?? ""} onChange={e => setForm(f => ({ ...f, endereco: { ...f.endereco, cidade: e.target.value } }))} />
                </div>
                <div className="space-y-2">
                  <Label>Estado (UF)</Label>
                  <Input value={form.endereco?.estado ?? ""} onChange={e => setForm(f => ({ ...f, endereco: { ...f.endereco, estado: e.target.value } }))} placeholder="SP" maxLength={2} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar Alterações" : "Cadastrar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
