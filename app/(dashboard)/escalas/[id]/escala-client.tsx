"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Plus, Trash2, Eye, Pencil, Printer, Loader2 } from "lucide-react"
import Link from "next/link"

const DIAS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
]

const MESES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  confirmando: "Confirmando",
  finalizada: "Finalizada",
  enviada: "Enviada",
}

const DIA_COLORS: Record<number, string> = {
  0: "text-teal-700 font-semibold",    // Domingo
  5: "text-amber-600 font-semibold",   // Sexta-feira
}

function getDiaSemanaFromDate(dateStr: string): number {
  if (!dateStr) return 0
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(y, m - 1, d).getDay()
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-")
  return `${d}/${m}/${y}`
}

interface RowData {
  _key: string
  id?: string
  data_culto: string
  dia_semana: number
  horario: string
  tipo_culto: string
  membro_oracao_id: string
  membro_louvor_id: string
  membro_pregacao_id: string
  observacoes: string
  // extra joined data for view mode
  membro_oracao?: { id: string; nome: string } | null
  membro_louvor?: { id: string; nome: string } | null
  membro_pregacao?: { id: string; nome: string } | null
  _deleted?: boolean
}

interface EscalaClientProps {
  escala: {
    id: string
    mes: number
    ano: number
    status: string
    data_geracao: string
  }
  detalhes: any[]
  membros: { id: string; nome: string }[]
  profile: any
}

let keyCounter = 0
function newKey() {
  return `row-${++keyCounter}-${Date.now()}`
}

function detalheToRow(d: any): RowData {
  return {
    _key: d.id ?? newKey(),
    id: d.id,
    data_culto: d.data_culto ?? "",
    dia_semana: d.dia_semana ?? 0,
    horario: d.horario ?? "",
    tipo_culto: d.tipo_culto ?? "",
    membro_oracao_id: d.membro_oracao_id ?? "",
    membro_louvor_id: d.membro_louvor_id ?? "",
    membro_pregacao_id: d.membro_pregacao_id ?? "",
    observacoes: d.observacoes ?? "",
    membro_oracao: d.membro_oracao ?? null,
    membro_louvor: d.membro_louvor ?? null,
    membro_pregacao: d.membro_pregacao ?? null,
  }
}

export default function EscalaClient({ escala, detalhes, membros, profile }: EscalaClientProps) {
  const router = useRouter()
  const { toast } = useToast()

  const isEditable = escala.status === "rascunho" || escala.status === "confirmando"
  const [editMode, setEditMode] = useState(isEditable)
  const [rows, setRows] = useState<RowData[]>(() => detalhes.map(detalheToRow))
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const igrejaNome: string = profile?.igrejas?.nome ?? profile?.igreja?.nome ?? ""

  const updateRow = useCallback((key: string, field: keyof RowData, value: string | number) => {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r
      const updated = { ...r, [field]: value }
      if (field === "data_culto" && typeof value === "string") {
        updated.dia_semana = getDiaSemanaFromDate(value)
      }
      return updated
    }))
  }, [])

  const addRow = useCallback(() => {
    const today = new Date().toISOString().split("T")[0]
    setRows(prev => [
      ...prev,
      {
        _key: newKey(),
        id: undefined,
        data_culto: today,
        dia_semana: getDiaSemanaFromDate(today),
        horario: "",
        tipo_culto: "",
        membro_oracao_id: "",
        membro_louvor_id: "",
        membro_pregacao_id: "",
        observacoes: "",
      },
    ])
  }, [])

  const deleteRow = useCallback((key: string) => {
    setRows(prev => {
      const row = prev.find(r => r._key === key)
      if (row?.id) {
        setDeletedIds(ids => [...ids, row.id!])
      }
      return prev.filter(r => r._key !== key)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const escalaId = escala.id
      const baseUrl = `/api/escalas/${escalaId}/detalhes`

      // DELETE removed rows
      for (const id of deletedIds) {
        const res = await fetch(`${baseUrl}?detalheId=${id}`, { method: "DELETE" })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error ?? "Erro ao deletar culto")
        }
      }
      setDeletedIds([])

      // UPDATE or INSERT rows
      const updatedRows: RowData[] = []
      for (const row of rows) {
        const payload = {
          data_culto: row.data_culto,
          dia_semana: row.dia_semana,
          horario: row.horario || null,
          tipo_culto: row.tipo_culto || null,
          membro_oracao_id: row.membro_oracao_id || null,
          membro_louvor_id: row.membro_louvor_id || null,
          membro_pregacao_id: row.membro_pregacao_id || null,
          observacoes: row.observacoes || null,
        }

        if (row.id) {
          // PATCH existing
          const res = await fetch(baseUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ detalheId: row.id, ...payload }),
          })
          const j = await res.json()
          if (!res.ok) throw new Error(j.error ?? "Erro ao salvar culto")
          updatedRows.push({ ...row, ...j.data })
        } else {
          // POST new
          const res = await fetch(baseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          const j = await res.json()
          if (!res.ok) throw new Error(j.error ?? "Erro ao criar culto")
          updatedRows.push({ ...row, id: j.data.id, _key: j.data.id })
        }
      }
      setRows(updatedRows)

      toast({ title: "Escala salva com sucesso!" })
      router.refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  const memberName = (id: string) => membros.find(m => m.id === id)?.nome ?? "—"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/escalas">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight leading-tight">
              Escala de Cultos
              {igrejaNome ? ` — ${igrejaNome}` : ""} | {MESES[escala.mes]} de {escala.ano}
            </h1>
            <Badge variant="secondary">{STATUS_LABELS[escala.status] ?? escala.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {!editMode && (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditMode(v => !v)}
          >
            {editMode ? (
              <><Eye className="h-4 w-4 mr-1.5" />Visualizar</>
            ) : (
              <><Pencil className="h-4 w-4 mr-1.5" />Editar</>
            )}
          </Button>
        </div>
      </div>

      {/* Edit mode */}
      {editMode ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground text-left">
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Data</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Dia da Semana</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Oração</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Louvor</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Pregação</th>
                  <th className="px-3 py-2 font-medium whitespace-nowrap">Observações</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhum culto. Clique em "Adicionar Culto" para começar.
                    </td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row._key} className="border-t hover:bg-muted/30">
                    <td className="px-2 py-1.5">
                      <input
                        type="date"
                        value={row.data_culto}
                        onChange={e => updateRow(row._key, "data_culto", e.target.value)}
                        className="h-8 w-36 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground text-xs">
                      {DIAS[row.dia_semana] ?? "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.membro_oracao_id}
                        onChange={e => updateRow(row._key, "membro_oracao_id", e.target.value)}
                        className="h-8 w-40 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">— Nenhum —</option>
                        {membros.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.membro_louvor_id}
                        onChange={e => updateRow(row._key, "membro_louvor_id", e.target.value)}
                        className="h-8 w-40 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">— Nenhum —</option>
                        {membros.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.membro_pregacao_id}
                        onChange={e => updateRow(row._key, "membro_pregacao_id", e.target.value)}
                        className="h-8 w-40 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">— Nenhum —</option>
                        {membros.map(m => (
                          <option key={m.id} value={m.id}>{m.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={row.observacoes}
                        onChange={e => updateRow(row._key, "observacoes", e.target.value)}
                        placeholder="Observações..."
                        className="h-8 w-44 rounded border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteRow(row._key)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1.5" />
              Adicionar Culto
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando...</>
              ) : (
                "Salvar Tudo"
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* View mode */
        <div className="overflow-x-auto rounded-md border print:border-none">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#2d5a27", color: "#fff" }}>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Data</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Dia da Semana</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Oração</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Louvor</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Pregação</th>
                <th className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">Observações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhum culto nesta escala.
                  </td>
                </tr>
              )}
              {rows.map((row, idx) => {
                const orNome = row.membro_oracao?.nome ?? (row.membro_oracao_id ? memberName(row.membro_oracao_id) : "—")
                const lovNome = row.membro_louvor?.nome ?? (row.membro_louvor_id ? memberName(row.membro_louvor_id) : "—")
                const pregNome = row.membro_pregacao?.nome ?? (row.membro_pregacao_id ? memberName(row.membro_pregacao_id) : "—")
                const diaColor = DIA_COLORS[row.dia_semana] ?? "text-gray-600"

                return (
                  <tr
                    key={row._key}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                      {formatDate(row.data_culto)}
                    </td>
                    <td className={`px-4 py-2.5 whitespace-nowrap ${diaColor}`}>
                      {DIAS[row.dia_semana] ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">{orNome || "—"}</td>
                    <td className="px-4 py-2.5">{lovNome || "—"}</td>
                    <td className="px-4 py-2.5">{pregNome || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{row.observacoes || "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
