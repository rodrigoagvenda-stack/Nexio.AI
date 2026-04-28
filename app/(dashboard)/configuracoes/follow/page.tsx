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
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  CalendarClock,
  GripVertical,
  Sparkles,
  Pencil,
} from 'lucide-react'

interface FollowStep {
  id?: string
  dia_offset: number
  horario: string
  mensagem: string
  usar_ia: boolean
  ordem: number
}

interface FollowSequence {
  id: string
  nome: string
  tipo: 'follow_geral' | 'anti_noshow'
  ativo: boolean
  follow_steps: FollowStep[]
}

const TIPO_CONFIG = {
  follow_geral: {
    label: 'Follow Geral',
    desc: 'Dispara após X dias sem resposta do lead',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    icon: Clock,
    offsetLabel: 'Dias sem resposta',
  },
  anti_noshow: {
    label: 'Anti-Noshow',
    desc: 'Lembretes baseados na call agendada',
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    icon: CalendarClock,
    offsetLabel: 'Horas (negativo = antes, positivo = depois)',
  },
}

const EMPTY_STEP = (): FollowStep => ({
  dia_offset: 1,
  horario: '09:00',
  mensagem: '',
  usar_ia: false,
  ordem: 0,
})

type SequenciaTipo = 'follow_geral' | 'anti_noshow'

const EMPTY_FORM: {
  nome: string
  tipo: SequenciaTipo
  ativo: boolean
  steps: FollowStep[]
} = {
  nome: '',
  tipo: 'follow_geral',
  ativo: true,
  steps: [EMPTY_STEP()],
}

export default function FollowPage() {
  const [sequences, setSequences] = useState<FollowSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FollowSequence | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const loadSequences = useCallback(async () => {
    try {
      const res = await fetch('/api/follow/sequences')
      const data = await res.json()
      setSequences(data.sequences ?? [])
    } catch {
      toast({ title: 'Erro ao carregar cadências', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSequences() }, [loadSequences])

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(seq: FollowSequence) {
    setEditing(seq)
    setForm({
      nome: seq.nome,
      tipo: seq.tipo,
      ativo: seq.ativo,
      steps: seq.follow_steps.length > 0
        ? seq.follow_steps.map((s) => ({ ...s, mensagem: s.mensagem ?? '' }))
        : [EMPTY_STEP()],
    })
    setDialogOpen(true)
  }

  function addStep() {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { ...EMPTY_STEP(), dia_offset: prev.steps.length + 1, ordem: prev.steps.length },
      ],
    }))
  }

  function removeStep(i: number) {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }))
  }

  function updateStep(i: number, patch: Partial<FollowStep>) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, idx) => idx === i ? { ...s, ...patch } : s),
    }))
  }

  async function handleSave() {
    if (!form.nome || !form.tipo) {
      toast({ title: 'Nome e tipo são obrigatórios', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        nome: form.nome,
        tipo: form.tipo,
        ativo: form.ativo,
        steps: form.steps.map((s, i) => ({ ...s, ordem: i })),
      }

      let res: Response
      if (editing) {
        res = await fetch(`/api/follow/sequences/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/follow/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: editing ? 'Cadência atualizada!' : 'Cadência criada!' })
      setDialogOpen(false)
      loadSequences()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(seq: FollowSequence) {
    try {
      const res = await fetch(`/api/follow/sequences/${seq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !seq.ativo }),
      })
      if (!res.ok) throw new Error()
      setSequences((prev) => prev.map((s) => s.id === seq.id ? { ...s, ativo: !s.ativo } : s))
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/follow/sequences/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setSequences((prev) => prev.filter((s) => s.id !== id))
      toast({ title: 'Cadência removida' })
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  const tipoConfig = TIPO_CONFIG[form.tipo]
  const TipoIcon = tipoConfig.icon

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
            <Clock className="w-6 h-6 text-primary" /> Follow-up
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadências automáticas de follow-up para leads sem resposta
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nova cadência
        </Button>
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Clock className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">Nenhuma cadência configurada</p>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" />
              Criar primeira cadência
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sequences.map((seq) => {
            const cfg = TIPO_CONFIG[seq.tipo]
            const Icon = cfg.icon
            return (
              <Card key={seq.id}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{seq.nome}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        {!seq.ativo && <Badge variant="secondary">Inativa</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{cfg.desc}</p>

                      {/* Timeline dos passos */}
                      {seq.follow_steps.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {seq.follow_steps.map((step, i) => (
                            <div
                              key={step.id ?? i}
                              className="flex items-center gap-1.5 text-xs bg-muted/50 border border-border rounded-lg px-2 py-1"
                            >
                              <span className="font-medium text-muted-foreground">
                                {seq.tipo === 'anti_noshow'
                                  ? `${step.dia_offset > 0 ? '+' : ''}${step.dia_offset}h`
                                  : `D+${step.dia_offset}`}
                              </span>
                              <span className="text-muted-foreground/60">·</span>
                              <span>{step.horario.slice(0, 5)}</span>
                              {step.usar_ia && <Sparkles className="w-3 h-3 text-primary" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch checked={seq.ativo} onCheckedChange={() => handleToggle(seq)} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(seq)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(seq.id)}
                        disabled={deleting === seq.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deleting === seq.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cadência' : 'Nova cadência de follow-up'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Follow 7 dias"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm((p) => ({ ...p, tipo: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_geral">Follow Geral (dias sem resposta)</SelectItem>
                    <SelectItem value="anti_noshow">Anti-Noshow (call agendada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium">Cadência ativa</p>
                <p className="text-xs text-muted-foreground">{tipoConfig.desc}</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))} />
            </div>

            {/* Steps */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Passos da cadência</p>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar passo
                </Button>
              </div>

              {form.steps.map((step, i) => (
                <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <GripVertical className="w-4 h-4" />
                      Passo {i + 1}
                    </div>
                    {form.steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeStep(i)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{tipoConfig.offsetLabel}</Label>
                      <Input
                        type="number"
                        value={step.dia_offset}
                        onChange={(e) => updateStep(i, { dia_offset: parseInt(e.target.value) || 1 })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Horário de disparo</Label>
                      <Input
                        type="time"
                        value={step.horario}
                        onChange={(e) => updateStep(i, { horario: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={step.usar_ia}
                      onCheckedChange={(v) => updateStep(i, { usar_ia: v })}
                    />
                    <span className="text-sm flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Gerar mensagem com IA
                    </span>
                  </div>

                  {!step.usar_ia && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mensagem</Label>
                      <Textarea
                        value={step.mensagem}
                        onChange={(e) => updateStep(i, { mensagem: e.target.value })}
                        placeholder="Olá! Tudo bem? Gostaria de retomar nossa conversa…"
                        className="min-h-[80px] text-sm resize-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Criar cadência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
