'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2, Zap, BookOpen, AlertCircle, Upload, CheckCircle, GitFork } from 'lucide-react'
import Link from 'next/link'

interface SdrFlow {
  id: string
  nome: string
  descricao: string | null
  numero_whatsapp: string
  tipo: 'inbound' | 'outbound' | 'ambos'
  ativo: boolean
  orchestrator_prompt: string | null
  conhecimento_ativo: boolean
  objecoes_ativo: boolean
  event_title_template: string | null
  created_at: string
}

const TIPO_LABEL: Record<string, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  ambos: 'Inbound + Outbound',
}

const TIPO_COLOR: Record<string, string> = {
  inbound: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  outbound: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  ambos: 'bg-green-500/10 text-green-600 border-green-500/20',
}

type FlowTipo = 'inbound' | 'outbound' | 'ambos'

const DEFAULT_FORM: {
  nome: string
  descricao: string
  numero_whatsapp: string
  tipo: FlowTipo
  orchestrator_prompt: string
  conhecimento_ativo: boolean
  objecoes_ativo: boolean
  event_title_template: string
} = {
  nome: '',
  descricao: '',
  numero_whatsapp: '',
  tipo: 'inbound',
  orchestrator_prompt: '',
  conhecimento_ativo: true,
  objecoes_ativo: false,
  event_title_template: '',
}

export default function FluxosPage() {
  const [flows, setFlows] = useState<SdrFlow[]>([])
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [uploadDone, setUploadDone] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SdrFlow | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)

  const loadFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/flows')
      const data = await res.json()
      setFlows(data.flows ?? [])
    } catch {
      toast({ title: 'Erro ao carregar fluxos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFlows() }, [loadFlows])

  function openNew() {
    setEditing(null)
    setForm(DEFAULT_FORM)
    setDialogOpen(true)
  }

  function openEdit(flow: SdrFlow) {
    setEditing(flow)
    setForm({
      nome: flow.nome,
      descricao: flow.descricao ?? '',
      numero_whatsapp: flow.numero_whatsapp,
      tipo: flow.tipo,
      orchestrator_prompt: flow.orchestrator_prompt ?? '',
      conhecimento_ativo: flow.conhecimento_ativo,
      objecoes_ativo: flow.objecoes_ativo,
      event_title_template: flow.event_title_template ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.nome || !form.tipo) {
      toast({ title: 'Nome e tipo são obrigatórios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        descricao: form.descricao || null,
        orchestrator_prompt: form.orchestrator_prompt || null,
        event_title_template: form.event_title_template || null,
      }

      let res: Response
      if (editing) {
        res = await fetch(`/api/sdr/flows/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/sdr/flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: editing ? 'Fluxo atualizado!' : 'Fluxo criado!' })
      setDialogOpen(false)
      loadFlows()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(flow: SdrFlow) {
    try {
      const res = await fetch(`/api/sdr/flows/${flow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !flow.ativo }),
      })
      if (!res.ok) throw new Error()
      setFlows((prev) => prev.map((f) => f.id === flow.id ? { ...f, ativo: !f.ativo } : f))
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  async function handleUpload(flowId: string, type: 'knowledge' | 'objections', file: File) {
    const key = `${flowId}-${type}`
    setUploading((p) => ({ ...p, [key]: true }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/sdr/flows/${flowId}/${type}`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: `PDF processado! ${data.chunks} chunks indexados.` })
      setUploadDone((p) => ({ ...p, [key]: true }))
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar PDF', variant: 'destructive' })
    } finally {
      setUploading((p) => ({ ...p, [key]: false }))
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/sdr/flows/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setFlows((prev) => prev.filter((f) => f.id !== id))
      toast({ title: 'Fluxo removido' })
    } catch {
      toast({ title: 'Erro ao remover fluxo', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Fluxos SDR
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure até 3 fluxos de atendimento independentes por número WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/configuracoes/fluxos/mapa"
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <GitFork className="w-4 h-4" />
            Ver mapa
          </Link>
          <Button onClick={openNew} disabled={flows.length >= 3}>
            <Plus className="w-4 h-4 mr-2" />
            Novo fluxo
          </Button>
        </div>
      </div>

      {flows.length >= 3 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Limite de 3 fluxos atingido. Remova um para criar outro.
        </div>
      )}

      {flows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Zap className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhum fluxo configurado</p>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeiro fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {flows.map((flow) => (
            <Card key={flow.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{flow.nome}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${TIPO_COLOR[flow.tipo]}`}>
                        {TIPO_LABEL[flow.tipo]}
                      </span>
                      {!flow.ativo && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    {flow.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{flow.descricao}</p>
                    )}
                    {flow.numero_whatsapp && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📱 {flow.numero_whatsapp}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs flex items-center gap-1 ${flow.conhecimento_ativo ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <BookOpen className="w-3 h-3" />
                        Conhecimento {flow.conhecimento_ativo ? 'ativo' : 'inativo'}
                      </span>
                      <span className={`text-xs flex items-center gap-1 ${flow.objecoes_ativo ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <BookOpen className="w-3 h-3" />
                        Objeções {flow.objecoes_ativo ? 'ativo' : 'inativo'}
                      </span>
                    </div>

                    {/* Upload PDF */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleUpload(flow.id, 'knowledge', f)
                            e.target.value = ''
                          }}
                        />
                        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          uploading[`${flow.id}-knowledge`]
                            ? 'opacity-50 cursor-not-allowed bg-muted border-border'
                            : uploadDone[`${flow.id}-knowledge`]
                            ? 'bg-green-500/10 border-green-500/30 text-green-700'
                            : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}>
                          {uploading[`${flow.id}-knowledge`]
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : uploadDone[`${flow.id}-knowledge`]
                            ? <CheckCircle className="w-3 h-3" />
                            : <Upload className="w-3 h-3" />}
                          Base de conhecimento (PDF)
                        </span>
                      </label>

                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleUpload(flow.id, 'objections', f)
                            e.target.value = ''
                          }}
                        />
                        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          uploading[`${flow.id}-objections`]
                            ? 'opacity-50 cursor-not-allowed bg-muted border-border'
                            : uploadDone[`${flow.id}-objections`]
                            ? 'bg-green-500/10 border-green-500/30 text-green-700'
                            : 'bg-muted/50 border-border hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}>
                          {uploading[`${flow.id}-objections`]
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : uploadDone[`${flow.id}-objections`]
                            ? <CheckCircle className="w-3 h-3" />
                            : <Upload className="w-3 h-3" />}
                          Base de objeções (PDF)
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={flow.ativo}
                      onCheckedChange={() => handleToggle(flow)}
                      title={flow.ativo ? 'Desativar' : 'Ativar'}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(flow)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(flow.id)}
                      disabled={deleting === flow.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting === flow.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar fluxo' : 'Novo fluxo SDR'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome do fluxo *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Atendimento Inbound"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm((p) => ({ ...p, tipo: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="ambos">Inbound + Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Número WhatsApp</Label>
                <Input
                  value={form.numero_whatsapp}
                  onChange={(e) => setForm((p) => ({ ...p, numero_whatsapp: e.target.value }))}
                  placeholder="5511999999999"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Descreva o objetivo deste fluxo"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Título dos eventos no Google Calendar</Label>
              <Input
                value={form.event_title_template}
                onChange={(e) => setForm((p) => ({ ...p, event_title_template: e.target.value }))}
                placeholder="Ex: Reunião com {nome} — Tocli"
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para inserir o nome do lead. Se vazio: &quot;Call de venda — {'{nome}'}&quot;.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Prompt complementar do orquestrador</Label>
              <Textarea
                value={form.orchestrator_prompt}
                onChange={(e) => setForm((p) => ({ ...p, orchestrator_prompt: e.target.value }))}
                placeholder="Instruções adicionais específicas para este fluxo: tom de voz, produtos, restrições…"
                className="min-h-[120px] font-mono text-sm resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Injetado após o prompt base do orquestrador. Não substitui — complementa.
              </p>
            </div>

            <div className="space-y-3 pt-2 border-t border-border">
              <p className="text-sm font-medium">Ferramentas RAG</p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Base de conhecimento</p>
                  <p className="text-xs text-muted-foreground">Busca documentos para responder dúvidas</p>
                </div>
                <Switch
                  checked={form.conhecimento_ativo}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, conhecimento_ativo: v }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm">Base de objeções</p>
                  <p className="text-xs text-muted-foreground">Busca argumentos para lidar com objeções</p>
                </div>
                <Switch
                  checked={form.objecoes_ativo}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, objecoes_ativo: v }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Criar fluxo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
