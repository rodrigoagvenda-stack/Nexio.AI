"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Heart, Plus, X, Loader2, CheckCircle2, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Pedido {
  id: string
  titulo: string
  descricao: string
  categoria: string
  privacidade: string
  status: "ativo" | "respondido" | "cancelado"
  data_pedido: string
  testemunho?: string
  membros?: { nome: string }
}

const CATEGORIAS = ["saude", "familia", "financeiro", "trabalho", "espiritual", "outro"]
const CAT_LABEL: Record<string, string> = {
  saude: "Saúde", familia: "Família", financeiro: "Financeiro",
  trabalho: "Trabalho", espiritual: "Espiritual", outro: "Outro",
}
const CAT_COLOR: Record<string, string> = {
  saude: "bg-red-100 text-red-700",
  familia: "bg-blue-100 text-blue-700",
  financeiro: "bg-[#C1BC7A]/10 text-[#8a8345]",
  trabalho: "bg-orange-100 text-orange-700",
  espiritual: "bg-purple-100 text-purple-700",
  outro: "bg-gray-100 text-gray-700",
}

const EMPTY_FORM = {
  titulo: "",
  descricao: "",
  categoria: "espiritual",
  privacidade: "lideranca",
}

export default function PedidosOracaoPage() {
  const { toast } = useToast()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filtroStatus, setFiltroStatus] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [testemunhoId, setTestemunhoId] = useState<string | null>(null)
  const [testemunhoText, setTestemunhoText] = useState("")

  useEffect(() => { fetchPedidos() }, [filtroStatus])

  async function fetchPedidos() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroStatus) params.set("status", filtroStatus)
      const res = await fetch(`/api/pedidos-oracao?${params}`)
      const json = await res.json()
      setPedidos(json.data ?? [])
    } catch {
      toast({ variant: "destructive", title: "Erro ao carregar pedidos" })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!form.titulo || !form.descricao) {
      toast({ variant: "destructive", title: "Preencha título e descrição" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/pedidos-oracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast({ title: "Pedido registrado!" })
      setModalOpen(false)
      setForm(EMPTY_FORM)
      fetchPedidos()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  async function marcarRespondido(id: string) {
    try {
      await fetch(`/api/pedidos-oracao/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "respondido",
          data_resposta: new Date().toISOString(),
          testemunho: testemunhoText || null,
        }),
      })
      toast({ title: "Pedido marcado como respondido!" })
      setTestemunhoId(null)
      setTestemunhoText("")
      fetchPedidos()
    } catch {
      toast({ variant: "destructive", title: "Erro ao atualizar" })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este pedido de oração?")) return
    try {
      await fetch(`/api/pedidos-oracao/${id}`, { method: "DELETE" })
      fetchPedidos()
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    }
  }

  const filtrados = pedidos.filter(p => !filtroStatus || p.status === filtroStatus)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pedidos de Oração</h2>
          <p className="text-muted-foreground">Gerencie os pedidos de oração da igreja</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Pedido
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(["", "ativo", "respondido", "cancelado"] as const).map(s => (
          <Button key={s} variant={filtroStatus === s ? "default" : "outline"} size="sm" onClick={() => setFiltroStatus(s)}>
            {s === "" ? "Todos" : s === "ativo" ? "Ativos" : s === "respondido" ? "Respondidos" : "Cancelados"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Heart className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum pedido de oração</h3>
            <p className="text-sm text-muted-foreground mb-4">Comece registrando um pedido</p>
            <Button onClick={() => setModalOpen(true)}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(p => (
            <Card key={p.id} className={p.status === "respondido" ? "border-[#C1BC7A]/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[p.categoria] ?? CAT_COLOR.outro}`}>
                        {CAT_LABEL[p.categoria] ?? p.categoria}
                      </span>
                      {p.status === "respondido" && (
                        <Badge variant="outline" className="text-[#8a8345] border-[#C1BC7A]/40 text-xs">Respondido ✓</Badge>
                      )}
                      {p.membros?.nome && (
                        <span className="text-xs text-muted-foreground">{p.membros.nome}</span>
                      )}
                    </div>
                    <p className="font-medium">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.data_pedido).toLocaleDateString("pt-BR")} · {p.privacidade === "publico" ? "Público" : "Liderança"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                    >
                      {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    {p.status === "ativo" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-[#8a8345] hover:text-[#7a753a]"
                        title="Marcar como respondido"
                        onClick={() => setTestemunhoId(p.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expandido */}
                {expandedId === p.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <p className="text-sm text-muted-foreground">{p.descricao}</p>
                    {p.testemunho && (
                      <div className="mt-2 p-3 bg-[#C1BC7A]/5 dark:bg-[#C1BC7A]/5 rounded-md">
                        <p className="text-xs font-medium text-[#8a8345] mb-1">Testemunho:</p>
                        <p className="text-sm text-[#7a753a] dark:text-[#C1BC7A]">{p.testemunho}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Modal testemunho inline */}
                {testemunhoId === p.id && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    <p className="text-sm font-medium">Registrar testemunho (opcional)</p>
                    <textarea
                      value={testemunhoText}
                      onChange={e => setTestemunhoText(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Como Deus respondeu esse pedido..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => marcarRespondido(p.id)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setTestemunhoId(null); setTestemunhoText("") }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal novo pedido */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Novo Pedido de Oração</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Cura do irmão João" />
              </div>
              <div className="space-y-2">
                <Label>Descrição *</Label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Detalhe o pedido..."
                />
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CATEGORIAS.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Visibilidade</Label>
                  <select value={form.privacidade} onChange={e => setForm(f => ({ ...f, privacidade: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="lideranca">Só liderança</option>
                    <option value="publico">Público</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Heart className="mr-2 h-4 w-4" /> Registrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
