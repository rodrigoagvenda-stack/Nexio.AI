"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Plus, Trash2, Eye, Pencil, Printer, Loader2, Info } from "lucide-react"
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

const STATUS_STYLES: Record<string, string> = {
  rascunho: "bg-amber-100 text-amber-800 border border-amber-300",
  confirmando: "bg-blue-100 text-blue-800 border border-blue-300",
  finalizada: "bg-emerald-100 text-emerald-800 border border-emerald-300",
  enviada: "bg-purple-100 text-purple-800 border border-purple-300",
}

// Left border color and row tint by dia_semana
// 0 = Domingo → emerald, 3 = Quarta-feira → blue, 5 = Sexta-feira → amber, rest → gray
function getRowStyle(diaSemana: number): {
  borderColor: string
  bgEven: string
  bgOdd: string
  dayTextClass: string
} {
  switch (diaSemana) {
    case 0:
      return {
        borderColor: "#10b981",
        bgEven: "#f0fdf4",
        bgOdd: "#ffffff",
        dayTextClass: "text-emerald-700 font-semibold",
      }
    case 3:
      return {
        borderColor: "#3b82f6",
        bgEven: "#eff6ff",
        bgOdd: "#ffffff",
        dayTextClass: "text-blue-700 font-semibold",
      }
    case 5:
      return {
        borderColor: "#f59e0b",
        bgEven: "#fffbeb",
        bgOdd: "#ffffff",
        dayTextClass: "text-amber-700 font-semibold",
      }
    default:
      return {
        borderColor: "#9ca3af",
        bgEven: "#f9fafb",
        bgOdd: "#ffffff",
        dayTextClass: "text-gray-600",
      }
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join("")
}

const AVATAR_COLORS = [
  "#1a4a2e", "#2d7a4f", "#1d4ed8", "#7c3aed",
  "#b45309", "#0f766e", "#9f1239", "#065f46",
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function MemberChip({ name }: { name: string }) {
  if (!name || name === "—") {
    return <span className="text-gray-400 text-xs italic">—</span>
  }
  const initials = getInitials(name)
  const bg = avatarColor(name)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0"
        style={{ width: 24, height: 24, backgroundColor: bg }}
      >
        {initials}
      </span>
      <span className="text-sm text-gray-800 leading-tight">{name}</span>
    </span>
  )
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

  const igrejaNome: string = profile?.igrejas?.nome ?? profile?.igreja?.nome ?? "IPVB"

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

      for (const id of deletedIds) {
        const res = await fetch(`${baseUrl}?detalheId=${id}`, { method: "DELETE" })
        if (!res.ok) {
          const j = await res.json()
          throw new Error(j.error ?? "Erro ao deletar culto")
        }
      }
      setDeletedIds([])

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
          const res = await fetch(baseUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ detalheId: row.id, ...payload }),
          })
          const j = await res.json()
          if (!res.ok) throw new Error(j.error ?? "Erro ao salvar culto")
          updatedRows.push({ ...row, ...j.data })
        } else {
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

  const printDate = new Date().toLocaleDateString("pt-BR")
  const mesAnoLabel = `${MESES[escala.mes]} de ${escala.ano}`
  const statusLabel = STATUS_LABELS[escala.status] ?? escala.status
  const statusStyle = STATUS_STYLES[escala.status] ?? "bg-gray-100 text-gray-700 border border-gray-300"

  return (
    <>
      {/* ─── PRINT-ONLY DOCUMENT ─────────────────────────────────────────────── */}
      <div className="hidden print:block" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", color: "#111", background: "white" }}>

        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 14, borderBottom: "3px solid #1a4a2e", marginBottom: 22 }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect x="18" y="3" width="8" height="38" rx="2" fill="#1a4a2e"/>
            <rect x="5" y="14" width="34" height="8" rx="2" fill="#1a4a2e"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a4a2e", letterSpacing: 0.5, textTransform: "uppercase" }}>
              {igrejaNome || "Igreja Pentecostal Vale da Bênção"}
            </div>
            <div style={{ fontSize: 10, color: "#777", marginTop: 2 }}>Sistema de Gestão para Igrejas</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 10, color: "#888" }}>
            <div>Emitido em</div>
            <div style={{ fontWeight: 600, color: "#444" }}>{printDate}</div>
          </div>
        </div>

        {/* Document title block */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#888", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
            Escala de Cultos
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#1a4a2e", letterSpacing: 1 }}>
            {MESES[escala.mes]} {escala.ano}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ display: "inline-block", padding: "3px 14px", border: "1px solid #bbb", borderRadius: 20, fontSize: 10, color: "#666" }}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              {[
                { label: "Data",          w: "10%" },
                { label: "Dia da Semana", w: "15%" },
                { label: "Tipo",          w: "10%" },
                { label: "Oração",        w: "16%" },
                { label: "Louvor",        w: "16%" },
                { label: "Pregação",      w: "16%" },
                { label: "Observações",   w: "17%" },
              ].map(({ label, w }) => (
                <th key={label} style={{ backgroundColor: "#1a4a2e", color: "white", padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, border: "1px solid #0f3320", width: w }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#999", border: "1px solid #ddd" }}>
                  Nenhum culto registrado nesta escala.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const orNome  = row.membro_oracao?.nome   ?? (row.membro_oracao_id   ? memberName(row.membro_oracao_id)   : "—")
              const lovNome = row.membro_louvor?.nome   ?? (row.membro_louvor_id   ? memberName(row.membro_louvor_id)   : "—")
              const pregNome = row.membro_pregacao?.nome ?? (row.membro_pregacao_id ? memberName(row.membro_pregacao_id) : "—")
              const bg = idx % 2 === 0 ? "#f4faf5" : "#ffffff"
              const cell: React.CSSProperties = { padding: "7px 10px", border: "1px solid #d0e8d4", verticalAlign: "middle" }
              return (
                <tr key={row._key} style={{ backgroundColor: bg }}>
                  <td style={{ ...cell, fontWeight: 600, whiteSpace: "nowrap" }}>{formatDate(row.data_culto)}</td>
                  <td style={{ ...cell, whiteSpace: "nowrap" }}>{DIAS[row.dia_semana] ?? "—"}</td>
                  <td style={{ ...cell, whiteSpace: "nowrap", color: "#555" }}>{row.tipo_culto || "—"}</td>
                  <td style={cell}>{orNome}</td>
                  <td style={cell}>{lovNome}</td>
                  <td style={cell}>{pregNome}</td>
                  <td style={{ ...cell, color: "#666" }}>{row.observacoes || "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 8, textAlign: "right", fontSize: 10, color: "#aaa" }}>
          {rows.length} culto{rows.length !== 1 ? "s" : ""} nesta escala
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 14, borderTop: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 9, color: "#bbb" }}>IPVB Sistema · ipvb.com.br</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 220, borderTop: "1px solid #999", marginBottom: 5 }} />
            <div style={{ fontSize: 9, color: "#999" }}>Assinatura do Responsável</div>
          </div>
          <div style={{ fontSize: 9, color: "#bbb" }}>Pág. 1</div>
        </div>
      </div>

      {/* ─── SCREEN LAYOUT ───────────────────────────────────────────────────── */}
      <div className="print:hidden space-y-5">

        {/* ── Hero header card ── */}
        <div
          className="rounded-2xl overflow-hidden shadow-lg"
          style={{ background: "linear-gradient(135deg, #1a4a2e 0%, #2d7a4f 100%)" }}
        >
          <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Left: back + title */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Link href="/escalas">
                <button className="mt-0.5 rounded-full p-1.5 text-white/70 hover:text-white hover:bg-white/15 transition-colors shrink-0">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </Link>
              <div className="min-w-0">
                <p className="text-white/60 text-xs font-medium uppercase tracking-widest mb-0.5">
                  {igrejaNome}
                </p>
                <h1 className="text-white text-2xl font-bold leading-tight tracking-tight">
                  Escala de Cultos
                </h1>
                <p className="text-emerald-200 text-base font-semibold mt-0.5">
                  {mesAnoLabel}
                </p>
              </div>
            </div>

            {/* Right: status badge + action buttons */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusStyle}`}>
                {statusLabel}
              </span>

              {!editMode && (
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </button>
              )}

              <button
                onClick={() => setEditMode(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium bg-white text-[#1a4a2e] hover:bg-emerald-50 transition-colors font-semibold shadow"
              >
                {editMode ? (
                  <><Eye className="h-3.5 w-3.5" />Visualizar</>
                ) : (
                  <><Pencil className="h-3.5 w-3.5" />Editar</>
                )}
              </button>
            </div>
          </div>

          {/* Stats strip */}
          <div className="border-t border-white/10 px-6 py-2.5 flex gap-6">
            <div className="text-center">
              <p className="text-white text-lg font-bold leading-none">{rows.length}</p>
              <p className="text-white/55 text-[11px] mt-0.5">Cultos</p>
            </div>
            <div className="text-center">
              <p className="text-white text-lg font-bold leading-none">{membros.length}</p>
              <p className="text-white/55 text-[11px] mt-0.5">Membros</p>
            </div>
            {escala.data_geracao && (
              <div className="text-center">
                <p className="text-white text-base font-semibold leading-none">{formatDate(escala.data_geracao.split("T")[0])}</p>
                <p className="text-white/55 text-[11px] mt-0.5">Gerada em</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Empty info banner (view mode only) ── */}
        {!editMode && rows.length === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-800 leading-relaxed">
              A escala é gerada automaticamente com base nos ministérios dos membros cadastrados.
              Adicione membros às funções (Oração, Louvor, Pregação...) em{" "}
              <strong>Membros → Funções</strong>.
            </p>
          </div>
        )}

        {/* ── EDIT MODE ── */}
        {editMode ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#1a4a2e" }}>
                    {/* color indicator column */}
                    <th className="w-1 py-3 px-0" />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Dia da Semana</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Oração</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Louvor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Pregação</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Observações</th>
                    <th className="w-10 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                        Nenhum culto adicionado. Clique em{" "}
                        <span className="font-semibold text-gray-600">"Adicionar Culto"</span>{" "}
                        para começar.
                      </td>
                    </tr>
                  )}
                  {rows.map((row, idx) => {
                    const style = getRowStyle(row.dia_semana)
                    const bg = idx % 2 === 0 ? style.bgEven : style.bgOdd
                    return (
                      <tr
                        key={row._key}
                        className="border-t border-gray-100 hover:brightness-95 transition-all"
                        style={{ backgroundColor: bg }}
                      >
                        {/* Color indicator strip */}
                        <td
                          className="w-1 p-0"
                          style={{ backgroundColor: style.borderColor, minWidth: 4 }}
                        />
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={row.data_culto}
                            onChange={e => updateRow(row._key, "data_culto", e.target.value)}
                            className="h-8 w-36 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                          />
                        </td>
                        <td className={`px-4 py-2 whitespace-nowrap text-xs ${style.dayTextClass}`}>
                          {DIAS[row.dia_semana] ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.membro_oracao_id}
                            onChange={e => updateRow(row._key, "membro_oracao_id", e.target.value)}
                            className="h-8 w-44 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                          >
                            <option value="">— Nenhum —</option>
                            {membros.map(m => (
                              <option key={m.id} value={m.id}>{m.nome}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.membro_louvor_id}
                            onChange={e => updateRow(row._key, "membro_louvor_id", e.target.value)}
                            className="h-8 w-44 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                          >
                            <option value="">— Nenhum —</option>
                            {membros.map(m => (
                              <option key={m.id} value={m.id}>{m.nome}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.membro_pregacao_id}
                            onChange={e => updateRow(row._key, "membro_pregacao_id", e.target.value)}
                            className="h-8 w-44 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                          >
                            <option value="">— Nenhum —</option>
                            {membros.map(m => (
                              <option key={m.id} value={m.id}>{m.nome}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.observacoes}
                            onChange={e => updateRow(row._key, "observacoes", e.target.value)}
                            placeholder="Observações..."
                            className="h-8 w-44 rounded-lg border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => deleteRow(row._key)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remover culto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Edit action bar */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border-2 border-dashed border-emerald-400 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar Culto
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full px-6 py-2 text-sm font-semibold text-white transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: saving ? "#9ca3af" : "linear-gradient(135deg, #1a4a2e, #2d7a4f)" }}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                ) : (
                  "Salvar Tudo"
                )}
              </button>
            </div>
          </div>
        ) : (
          /* ── VIEW MODE ── */
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white">
            {rows.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <div className="text-4xl mb-3 opacity-30">✝</div>
                <p className="text-sm font-medium text-gray-500">Nenhum culto nesta escala.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: "#1a4a2e" }}>
                      <th className="w-1 py-3 px-0" />
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Dia</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Oração</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Louvor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Pregação</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white/80 uppercase tracking-wider whitespace-nowrap">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const style = getRowStyle(row.dia_semana)
                      const bg = idx % 2 === 0 ? style.bgEven : style.bgOdd
                      const orNome = row.membro_oracao?.nome ?? (row.membro_oracao_id ? memberName(row.membro_oracao_id) : "—")
                      const lovNome = row.membro_louvor?.nome ?? (row.membro_louvor_id ? memberName(row.membro_louvor_id) : "—")
                      const pregNome = row.membro_pregacao?.nome ?? (row.membro_pregacao_id ? memberName(row.membro_pregacao_id) : "—")

                      return (
                        <tr
                          key={row._key}
                          className="border-t border-gray-100 transition-colors"
                          style={{ backgroundColor: bg }}
                          onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.97)")}
                          onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
                        >
                          {/* Color indicator strip */}
                          <td
                            className="w-1 p-0"
                            style={{ backgroundColor: style.borderColor, minWidth: 4 }}
                          />
                          <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-800">
                            {formatDate(row.data_culto)}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${style.dayTextClass}`}>
                            {DIAS[row.dia_semana] ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">
                            {row.tipo_culto || <span className="text-gray-400 italic text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <MemberChip name={orNome} />
                          </td>
                          <td className="px-4 py-3">
                            <MemberChip name={lovNome} />
                          </td>
                          <td className="px-4 py-3">
                            <MemberChip name={pregNome} />
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm max-w-[160px] truncate" title={row.observacoes || ""}>
                            {row.observacoes || <span className="text-gray-300 italic text-xs">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
