"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Plus, Trash2, Eye, Pencil, Printer, Loader2, Info, Sparkles } from "lucide-react"
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
    return <span className="text-muted-foreground text-xs italic">—</span>
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
      <span className="text-sm leading-tight">{name}</span>
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
    igreja_id?: string
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
  const [generating, setGenerating] = useState(false)

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

  const handleGerar = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/api/escalas/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes: escala.mes,
          ano: escala.ano,
          igreja_id: escala.igreja_id ?? profile?.igreja_id,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? "Erro ao gerar escala")
      toast({ title: "Escala gerada com sucesso!" })
      router.push(`/escalas/${j.data.id}`)
      router.refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao gerar", description: e.message })
    } finally {
      setGenerating(false)
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
      <div className="hidden print:block" style={{ fontFamily: "'Lato', 'Segoe UI', sans-serif", background: "white", colorScheme: "light" }}>

        {/* ── HEADER ── */}
        <div style={{
          background: "linear-gradient(160deg, #1a4330 0%, #2b6347 60%, #1e4d35 100%)",
          padding: "0 40px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          minHeight: 110,
          position: "relative",
          overflow: "hidden",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}>
          {/* Gold glow corner */}
          <div style={{
            position: "absolute", right: -60, top: -60,
            width: 240, height: 240, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,168,76,.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Dove logo circle */}
          <div style={{
            flexShrink: 0, width: 72, height: 72, borderRadius: "50%",
            background: "rgba(255,255,255,.13)",
            border: "1.5px solid rgba(255,255,255,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width={42} height={42}>
              <path d="M40 10 C38.5 16 35 19 37 26 C38 30 40 32 40 32 C40 32 42 30 43 26 C45 19 41.5 16 40 10Z" fill="#e8c87a"/>
              <ellipse cx="38" cy="50" rx="13" ry="8" fill="white" opacity=".95"/>
              <circle cx="50" cy="45" r="7" fill="white" opacity=".95"/>
              <path d="M56.5 44.5 L63 45.5 L56.5 46.5Z" fill="#c9a84c"/>
              <circle cx="52.5" cy="44" r="1.4" fill="#1e4d35"/>
              <path d="M25 47 C15 39 13 29 20 27 C27 25 33 36 36 46Z" fill="white" opacity=".8"/>
              <path d="M27 55 C23 61 19 67 17 72" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity=".8"/>
              <path d="M31 57 C28 64 26 69 25 74" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity=".8"/>
              <path d="M35 58 C34 65 33 70 34 75" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity=".7"/>
            </svg>
          </div>

          {/* Title block */}
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: 10.5,
              letterSpacing: 3.5, textTransform: "uppercase",
              color: "#e8c87a", marginBottom: 7, opacity: .9,
            }}>
              {igrejaNome || "Igreja Pentecostal Vale da Bênção"}
            </p>
            <h1 style={{
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700,
              fontSize: 22, color: "white", lineHeight: 1.25, letterSpacing: -.2,
            }}>
              Escala de Cultos &nbsp;|&nbsp; <span style={{ color: "#e8c87a", fontWeight: 800 }}>{mesAnoLabel}</span>
            </h1>
          </div>

          {/* Month badge */}
          <div style={{
            background: "rgba(201,168,76,.18)",
            border: "1px solid rgba(201,168,76,.55)",
            borderRadius: 6, padding: "7px 18px",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
            textTransform: "uppercase", color: "#e8c87a", whiteSpace: "nowrap",
          }}>
            {MESES[escala.mes]} {escala.ano}
          </div>
        </div>

        {/* ── GOLD ACCENT BAR ── */}
        <div style={{
          height: 4,
          background: "linear-gradient(90deg, #c9a84c 0%, #e8c87a 50%, #c9a84c 100%)",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }} />

        {/* ── TABLE ── */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              {[
                { label: "Data",          w: "11%" },
                { label: "Dia da Semana", w: "16%" },
                { label: "Oração",        w: "18%" },
                { label: "Louvor",        w: "18%" },
                { label: "Pregação",      w: "18%" },
                { label: "Observações",   w: "19%" },
              ].map(({ label, w }) => (
                <th key={label} style={{
                  backgroundColor: "#1e4d35",
                  color: "white",
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 700, fontSize: 11.5,
                  letterSpacing: 1.5, textTransform: "uppercase",
                  padding: "14px 18px", textAlign: "left",
                  borderRight: "1px solid rgba(255,255,255,.08)",
                  whiteSpace: "nowrap", width: w,
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#999", border: "1px solid #d0ddd6", fontSize: 13 }}>
                  Nenhum culto registrado nesta escala.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const orNome   = row.membro_oracao?.nome    ?? (row.membro_oracao_id    ? memberName(row.membro_oracao_id)    : "—")
              const lovNome  = row.membro_louvor?.nome    ?? (row.membro_louvor_id    ? memberName(row.membro_louvor_id)    : "—")
              const pregNome = row.membro_pregacao?.nome  ?? (row.membro_pregacao_id  ? memberName(row.membro_pregacao_id)  : "—")

              const bg: React.CSSProperties = idx % 2 === 0
                ? { backgroundColor: "#f7f9f6", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }
                : { backgroundColor: "#ffffff" }

              // Day badge style
              const dow = row.dia_semana
              let badgeBg = "#f5f0e6", badgeColor = "#7a6020"
              if (dow === 0) { badgeBg = "#ddeef9"; badgeColor = "#1a6fa8" }
              else if (dow === 3) { badgeBg = "#d5f0ea"; badgeColor = "#1a8a6f" }
              else if (dow === 5) { badgeBg = "#f5f0e6"; badgeColor = "#7a6020" }

              const cell: React.CSSProperties = { padding: "13px 18px", borderBottom: "1px solid #d0ddd6", borderRight: "1px solid #d0ddd6", verticalAlign: "middle", fontSize: 13.5 }

              const PersonCell = ({ name }: { name: string }) => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#3a7a57", flexShrink: 0, opacity: .6, display: "inline-block" }} />
                  {name === "—" ? <em style={{ color: "#999" }}>—</em> : name}
                </span>
              )

              return (
                <tr key={row._key} style={bg}>
                  <td style={{ ...cell, fontWeight: 700, fontSize: 13, color: "#2b6347", letterSpacing: .5, whiteSpace: "nowrap" }}>
                    {formatDate(row.data_culto)}
                  </td>
                  <td style={{ ...cell }}>
                    <span style={{
                      display: "inline-block", padding: "3px 10px",
                      borderRadius: 20, fontSize: 12, fontWeight: 700,
                      letterSpacing: .5, whiteSpace: "nowrap",
                      backgroundColor: badgeBg, color: badgeColor,
                      WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
                    }}>
                      {DIAS[dow] ?? "—"}
                    </span>
                  </td>
                  <td style={{ ...cell, color: "#1a2e24" }}><PersonCell name={orNome} /></td>
                  <td style={{ ...cell, color: "#1a2e24" }}><PersonCell name={lovNome} /></td>
                  <td style={{ ...cell, color: "#1a2e24" }}><PersonCell name={pregNome} /></td>
                  <td style={{ ...cell, color: "#5a7060", fontStyle: "italic", borderRight: "none" }}>{row.observacoes || "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* ── FOOTER ── */}
        <div style={{
          backgroundColor: "#1e4d35",
          padding: "14px 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 8,
          WebkitPrintColorAdjust: "exact", printColorAdjust: "exact",
        }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.5)", letterSpacing: 1, textTransform: "uppercase" }}>
            {igrejaNome} &mdash; {mesAnoLabel}
          </p>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "Domingo",      color: "#1a6fa8" },
              { label: "Quarta-feira", color: "#1a8a6f" },
              { label: "Sexta-feira",  color: "#c9a84c" },
            ].map(({ label, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,.55)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, display: "inline-block", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
                {label}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─── SCREEN LAYOUT ───────────────────────────────────────────────────── */}
      <div className="print:hidden space-y-5">

        {/* ── Clean page header ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/escalas">
              <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">Escala de Cultos</h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusStyle}`}>
                  {statusLabel}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{mesAnoLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {rows.length === 0 && (
              <button
                onClick={handleGerar}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {generating
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando...</>
                  : <><Sparkles className="h-3.5 w-3.5" />Gerar Automaticamente</>
                }
              </button>
            )}
            {!editMode && rows.length > 0 && (
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-border bg-card hover:bg-muted transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </button>
            )}
            <button
              onClick={() => setEditMode(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium border border-border bg-card hover:bg-muted transition-colors"
            >
              {editMode
                ? <><Eye className="h-3.5 w-3.5" />Visualizar</>
                : <><Pencil className="h-3.5 w-3.5" />Editar</>
              }
            </button>
          </div>
        </div>

        {/* ── Empty state ── */}
        {!editMode && rows.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">Nenhum culto nesta escala</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Clique em <strong>Gerar Automaticamente</strong> para preencher a escala com base nos membros e suas funções cadastradas.
            </p>
            <button
              onClick={handleGerar}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors shadow-sm"
            >
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</>
                : <><Sparkles className="h-4 w-4" />Gerar Automaticamente</>
              }
            </button>
          </div>
        )}

        {/* ── EDIT MODE ── */}
        {editMode ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-border shadow-sm bg-card">
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
                      <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">
                        Nenhum culto adicionado. Clique em{" "}
                        <span className="font-semibold">"Adicionar Culto"</span>{" "}
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
                            className="h-8 w-36 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
                          />
                        </td>
                        <td className={`px-4 py-2 whitespace-nowrap text-xs ${style.dayTextClass}`}>
                          {DIAS[row.dia_semana] ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.membro_oracao_id}
                            onChange={e => updateRow(row._key, "membro_oracao_id", e.target.value)}
                            className="h-8 w-44 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
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
                            className="h-8 w-44 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
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
                            className="h-8 w-44 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
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
                            className="h-8 w-44 rounded-lg border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
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
          <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-card">
            {rows.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <div className="text-4xl mb-3 opacity-20">✝</div>
                <p className="text-sm font-medium">Nenhum culto nesta escala.</p>
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
                          className="border-t border-border transition-colors"
                          style={{ backgroundColor: bg }}
                          onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.97)")}
                          onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}
                        >
                          {/* Color indicator strip */}
                          <td
                            className="w-1 p-0"
                            style={{ backgroundColor: style.borderColor, minWidth: 4 }}
                          />
                          <td className="px-4 py-3 whitespace-nowrap font-semibold">
                            {formatDate(row.data_culto)}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${style.dayTextClass}`}>
                            {DIAS[row.dia_semana] ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm whitespace-nowrap">
                            {row.tipo_culto || <span className="italic text-xs">—</span>}
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
                          <td className="px-4 py-3 text-muted-foreground text-sm max-w-[160px] truncate" title={row.observacoes || ""}>
                            {row.observacoes || <span className="italic text-xs opacity-40">—</span>}
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
