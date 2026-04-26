"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Loader2,
  FileDown, Trash2, AlertTriangle, CalendarRange, Search, UserCircle, X,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lancamento {
  id: string
  data: string
  tipo: "entrada" | "saida"
  descricao: string
  valor: number
  forma_pagamento: string
  status: string
  membro_id?: string
  membros?: { nome: string } | null
  categorias_financeiras?: { nome: string; cor: string }
}

interface Categoria {
  id: string
  nome: string
  tipo: string
  cor: string
}

interface Membro {
  id: string
  nome: string
  telefone?: string
}

interface ChartPoint { label: string; entradas: number; saidas: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAS = ["dinheiro", "pix", "transferencia", "debito", "credito", "boleto", "cheque"]
const MESES  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const MESES_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
const DIAS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]

const EMPTY_FORM = {
  tipo: "entrada" as "entrada" | "saida",
  data: new Date().toISOString().split("T")[0],
  categoria_id: "",
  descricao: "",
  valor: "",
  forma_pagamento: "pix",
  status: "efetivado",
  observacoes: "",
  membro_id: "",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().split("T")[0] }

function presetRange(p: string): { from: string; to: string } {
  const n = new Date()
  if (p === "hoje") { const s = toISO(n); return { from: s, to: s } }
  if (p === "semana") {
    const day = n.getDay()
    const mon = new Date(n); mon.setDate(n.getDate() - day + (day === 0 ? -6 : 1))
    return { from: toISO(mon), to: toISO(n) }
  }
  if (p === "mes") {
    const from = new Date(n.getFullYear(), n.getMonth(), 1)
    const to   = new Date(n.getFullYear(), n.getMonth() + 1, 0)
    return { from: toISO(from), to: toISO(to) }
  }
  if (p === "ano") return { from: `${n.getFullYear()}-01-01`, to: `${n.getFullYear()}-12-31` }
  return { from: toISO(n), to: toISO(n) }
}

function periodLabel(from: string, to: string) {
  if (!from || !to) return ""
  const f = new Date(from + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  const t = new Date(to   + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  return from === to ? f : `${f} – ${t}`
}

function computeChart(lancamentos: Lancamento[], preset: string, from: string, to: string): ChartPoint[] {
  const acc = (arr: Lancamento[], t: "entrada" | "saida") =>
    arr.filter(l => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0)

  if (preset === "hoje" || from === to) return [{
    label: new Date(from + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    entradas: acc(lancamentos, "entrada"), saidas: acc(lancamentos, "saida"),
  }]

  if (preset === "semana") {
    const map: Record<string, ChartPoint> = {}
    for (const d = new Date(from + "T12:00:00"); d <= new Date(to + "T12:00:00"); d.setDate(d.getDate() + 1)) {
      const k = toISO(d); map[k] = { label: DIAS_SHORT[d.getDay()], entradas: 0, saidas: 0 }
    }
    for (const l of lancamentos) if (map[l.data]) {
      if (l.tipo === "entrada") map[l.data].entradas += Number(l.valor)
      else map[l.data].saidas += Number(l.valor)
    }
    return Object.values(map)
  }

  if (preset === "mes") {
    const weeks: ChartPoint[] = [1,2,3,4].map(w => ({ label: `Sem. ${w}`, entradas: 0, saidas: 0 }))
    for (const l of lancamentos) {
      const w = Math.min(Math.ceil(new Date(l.data + "T12:00:00").getDate() / 7), 4) - 1
      if (l.tipo === "entrada") weeks[w].entradas += Number(l.valor)
      else weeks[w].saidas += Number(l.valor)
    }
    return weeks
  }

  if (preset === "ano") {
    const months: ChartPoint[] = MESES_SHORT.map(label => ({ label, entradas: 0, saidas: 0 }))
    for (const l of lancamentos) {
      const m = new Date(l.data + "T12:00:00").getMonth()
      if (l.tipo === "entrada") months[m].entradas += Number(l.valor)
      else months[m].saidas += Number(l.valor)
    }
    return months
  }

  const diffDays = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
  if (diffDays <= 31) {
    const map: Record<string, ChartPoint> = {}
    for (const d = new Date(from + "T12:00:00"); d <= new Date(to + "T12:00:00"); d.setDate(d.getDate() + 1)) {
      const k = toISO(d)
      map[k] = { label: `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`, entradas: 0, saidas: 0 }
    }
    for (const l of lancamentos) if (map[l.data]) {
      if (l.tipo === "entrada") map[l.data].entradas += Number(l.valor)
      else map[l.data].saidas += Number(l.valor)
    }
    return Object.values(map)
  }

  const mmap: Record<string, ChartPoint> = {}
  for (const l of lancamentos) {
    const d = new Date(l.data + "T12:00:00")
    const k = `${d.getFullYear()}-${d.getMonth()}`
    if (!mmap[k]) mmap[k] = { label: `${MESES_SHORT[d.getMonth()]}/${d.getFullYear()}`, entradas: 0, saidas: 0 }
    if (l.tipo === "entrada") mmap[k].entradas += Number(l.valor)
    else mmap[k].saidas += Number(l.valor)
  }
  return Object.values(mmap)
}

// ─── MemberSearch component ───────────────────────────────────────────────────

function MemberSearch({ membros, value, onChange }: { membros: Membro[]; value: string; onChange: (id: string, nome: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ]       = useState("")
  const ref             = useRef<HTMLDivElement>(null)

  const selected = membros.find(m => m.id === value)
  const filtered = q ? membros.filter(m => m.nome.toLowerCase().includes(q.toLowerCase())) : membros

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2">
          <UserCircle className="h-4 w-4 text-primary shrink-0" />
          <span className="flex-1 text-sm">{selected.nome}</span>
          <button type="button" onClick={() => onChange("", "")} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            placeholder="Buscar membro dizimista…"
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
      {open && !selected && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-center text-muted-foreground">Nenhum membro encontrado</div>
          ) : filtered.slice(0, 20).map(m => (
            <button
              key={m.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted text-left transition-colors"
              onClick={() => { onChange(m.id, m.nome); setOpen(false); setQ("") }}
            >
              <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              {m.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { toast } = useToast()

  const [activePreset, setActivePreset] = useState("mes")
  const initR = presetRange("mes")
  const [dateFrom, setDateFrom] = useState(initR.from)
  const [dateTo,   setDateTo]   = useState(initR.to)

  const [igrejaId, setIgrejaId]   = useState("")
  const [igrejaNome, setIgrejaNome] = useState("")
  const [igrejaLogo, setIgrejaLogo] = useState("")
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias]   = useState<Categoria[]>([])
  const [membros, setMembros]         = useState<Membro[]>([])
  const [stats, setStats] = useState({ entradas: 0, saidas: 0, saldo: 0 })
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [filtroTipo, setFiltroTipo] = useState("")
  const [exportando, setExportando] = useState(false)
  const [membroNomeSelecionado, setMembroNomeSelecionado] = useState("")

  // Check if selected category is Dízimos
  const categoriaSelecionada = categorias.find(c => c.id === form.categoria_id)
  const isDizimo = form.tipo === "entrada" && categoriaSelecionada?.nome?.toLowerCase().includes("dízimo")

  // ── Load initial data ──
  useEffect(() => {
    const supabase = createClient()
    fetch("/api/financeiro/categorias").then(r => r.json()).then(j => setCategorias(j.data ?? [])).catch(() => {})

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase as any).from("profiles").select("igreja_id").eq("id", user.id).single()
        .then(async ({ data }: any) => {
          if (!data?.igreja_id) return
          setIgrejaId(data.igreja_id)
          // Load church info for PDF
          const { data: ig } = await (supabase as any).from("igrejas").select("nome, logo_url").eq("id", data.igreja_id).single()
          if (ig) { setIgrejaNome(ig.nome ?? "IPVB"); setIgrejaLogo(ig.logo_url ?? "") }
          // Load members for dízimo search
          const { data: mbs } = await (supabase as any).from("membros").select("id, nome, telefone").eq("igreja_id", data.igreja_id).eq("status", "ativo").order("nome")
          setMembros(mbs ?? [])
        })
    })
  }, [])

  // ── Fetch lancamentos ──
  const fetchLancamentos = useCallback(async (iid: string, tipo: string, from: string, to: string) => {
    if (!iid) return
    setLoading(true)
    try {
      const p = new URLSearchParams({ igreja_id: iid, pageSize: "500", data_inicio: from, data_fim: to })
      if (tipo) p.set("tipo", tipo)
      const res  = await fetch(`/api/financeiro/lancamentos?${p}`)
      const json = await res.json()
      const data: Lancamento[] = json.data ?? []
      setLancamentos(data)
      const ent = data.filter(l => l.tipo === "entrada").reduce((s, l) => s + Number(l.valor), 0)
      const sai = data.filter(l => l.tipo === "saida").reduce((s, l)  => s + Number(l.valor), 0)
      setStats({ entradas: ent, saidas: sai, saldo: ent - sai })
    } catch { toast({ variant: "destructive", title: "Erro ao carregar lançamentos" }) }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (igrejaId) fetchLancamentos(igrejaId, filtroTipo, dateFrom, dateTo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igrejaId, filtroTipo, dateFrom, dateTo])

  const chartData = useMemo(() => computeChart(lancamentos, activePreset, dateFrom, dateTo), [lancamentos, activePreset, dateFrom, dateTo])

  const chartTitle: Record<string, string> = {
    hoje: "Entradas vs Saídas — Hoje",
    semana: "Entradas vs Saídas — Esta semana",
    mes: "Entradas vs Saídas — Este mês",
    ano: "Entradas vs Saídas — Este ano",
  }

  // ── Form helpers ──
  function setTipo(tipo: "entrada" | "saida") { setForm(f => ({ ...f, tipo, categoria_id: "", membro_id: "" })) }
  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)

  // ── Save ──
  async function handleSave() {
    if (!form.categoria_id) { toast({ variant: "destructive", title: "Selecione uma categoria" }); return }
    if (!form.valor || !form.data) { toast({ variant: "destructive", title: "Preencha valor e data" }); return }
    if (isDizimo && !form.membro_id) { toast({ variant: "destructive", title: "Vincule o membro dizimista" }); return }
    setSaving(true)
    try {
      const res = await fetch("/api/financeiro/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igreja_id: igrejaId,
          tipo: form.tipo,
          data: form.data,
          categoria_id: form.categoria_id,
          descricao: form.descricao || categoriaSelecionada?.nome || "",
          valor: parseFloat(String(form.valor).replace(",", ".")),
          forma_pagamento: form.forma_pagamento,
          status: form.status,
          observacoes: form.observacoes || null,
          membro_id: form.membro_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast({ title: "Lançamento registrado!" })
      setModalOpen(false)
      setForm(EMPTY_FORM)
      setMembroNomeSelecionado("")
      fetchLancamentos(igrejaId, filtroTipo, dateFrom, dateTo)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally { setSaving(false) }
  }

  // ── Delete ──
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/financeiro/lancamentos/${deleteTarget}`, { method: "DELETE" })
      setDeleteTarget(null)
      fetchLancamentos(igrejaId, filtroTipo, dateFrom, dateTo)
    } catch { toast({ variant: "destructive", title: "Erro ao excluir" }) }
    finally { setDeleting(false) }
  }

  // ── PDF Export — professional ──
  async function exportarPDF() {
    setExportando(true)

    // Converte logo para base64 para funcionar no print (URLs externas bloqueiam no print)
    let logoBase64 = ""
    if (igrejaLogo) {
      try {
        const resp = await fetch(igrejaLogo)
        const blob = await resp.blob()
        logoBase64 = await new Promise<string>(resolve => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
      } catch { logoBase64 = "" }
    }

    const win = window.open("", "_blank")
    if (!win) { setExportando(false); return }

    const periodoLabel = periodLabel(dateFrom, dateTo)
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })

    const rows = lancamentos.map(l => {
      const cor = l.tipo === "entrada" ? "#15803d" : "#dc2626"
      const sinal = l.tipo === "saida" ? "−" : "+"
      const membroNome = l.membros?.nome || ""
      return `<tr>
        <td>${new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
        <td>${l.descricao}${membroNome ? `<br><span class="sub">Dizimista: ${membroNome}</span>` : ""}</td>
        <td>${l.categorias_financeiras?.nome ?? "—"}</td>
        <td><span class="tipo ${l.tipo === "entrada" ? "ent" : "sai"}">${l.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
        <td style="text-transform:capitalize">${l.forma_pagamento}</td>
        <td class="valor" style="color:${cor}">${sinal} ${formatCurrency(l.valor)}</td>
      </tr>`
    }).join("")

    const logoSrc = logoBase64 || igrejaLogo
    const logoHTML = logoSrc
      ? `<img src="${logoSrc}" alt="Logo" class="logo" />`
      : `<div class="logo-placeholder">${(igrejaNome || "IPVB").substring(0, 2).toUpperCase()}</div>`

    // Marca d'água como logo (base64 garante que aparece no print)
    const watermarkHTML = logoSrc
      ? `<img src="${logoSrc}" class="watermark-img" alt="" />`
      : `<div class="watermark">${igrejaNome || "IPVB"}</div>`

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>Relatório Financeiro — ${periodoLabel}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #1a1a1a; font-size: 11px; }

  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72px; font-weight: 900;
    color: rgba(193,188,122,0.06); white-space: nowrap;
    pointer-events: none; z-index: 0; letter-spacing: 4px;
    text-transform: uppercase;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .watermark-img {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    width: 380px; height: auto; opacity: 0.06;
    pointer-events: none; z-index: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .header {
    background: linear-gradient(135deg, #0f1117 0%, #1a1d28 100%);
    padding: 24px 32px; display: flex; align-items: center; gap: 20px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .logo { width: 52px; height: 52px; object-fit: contain; border-radius: 8px; }
  .logo-placeholder {
    width: 52px; height: 52px; border-radius: 8px;
    background: rgba(193,188,122,0.2); border: 1px solid rgba(193,188,122,0.4);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: #C1BC7A; flex-shrink: 0;
  }
  .header-text { flex: 1; }
  .header-church { color: rgba(255,255,255,0.5); font-size: 9px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
  .header-title { color: #fff; font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
  .header-period { color: #C1BC7A; font-size: 11px; font-weight: 500; margin-top: 4px; }
  .header-badge {
    background: rgba(193,188,122,0.15); border: 1px solid rgba(193,188,122,0.3);
    border-radius: 6px; padding: 8px 16px; text-align: center;
  }
  .header-badge .badge-label { color: rgba(255,255,255,0.5); font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 3px; }
  .header-badge .badge-date { color: #C1BC7A; font-size: 10px; font-weight: 600; }

  .accent-bar {
    height: 3px;
    background: linear-gradient(90deg, #C1BC7A 0%, #e8d87a 50%, #C1BC7A 100%);
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  .summary { display: flex; gap: 0; border-bottom: 1px solid #e5e7eb; }
  .summary-item {
    flex: 1; padding: 14px 24px; border-right: 1px solid #e5e7eb;
  }
  .summary-item:last-child { border-right: none; }
  .summary-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; margin-bottom: 6px; font-weight: 500; }
  .summary-value { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
  .ent-val { color: #15803d; }
  .sai-val { color: #dc2626; }
  .sal-val { color: ${stats.saldo >= 0 ? "#1d4ed8" : "#dc2626"}; }

  .content { padding: 0 32px 32px; position: relative; z-index: 1; }
  .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b7280; font-weight: 600; margin: 20px 0 8px; }

  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f8f9fa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th { padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
  td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; font-size: 10.5px; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sub { font-size: 9px; color: #9ca3af; display: block; margin-top: 1px; }
  .valor { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .tipo { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 600; }
  .ent { background: #dcfce7; color: #15803d; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sai { background: #fee2e2; color: #dc2626; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .footer {
    margin: 0 32px; padding: 12px 0;
    border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-left { font-size: 9px; color: #9ca3af; }
  .footer-right { font-size: 9px; color: #9ca3af; }
  .footer-church { font-weight: 600; color: #6b7280; }
  .cert { margin: 0 32px 24px; padding: 12px 16px; background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; }
  .cert-title { font-size: 9px; font-weight: 600; color: #374151; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  .cert-text { font-size: 10px; color: #6b7280; line-height: 1.6; }
  @media print { .watermark { position: fixed; } }
</style>
</head><body>

${watermarkHTML}

<!-- Header -->
<div class="header">
  ${logoHTML}
  <div class="header-text">
    <div class="header-church">${igrejaNome || "Igreja"}</div>
    <div class="header-title">Relatório Financeiro</div>
    <div class="header-period">${periodoLabel}</div>
  </div>
  <div class="header-badge">
    <div class="badge-label">Emitido em</div>
    <div class="badge-date">${hoje}</div>
  </div>
</div>
<div class="accent-bar"></div>

<!-- Summary -->
<div class="summary">
  <div class="summary-item">
    <div class="summary-label">Total de Entradas</div>
    <div class="summary-value ent-val">${formatCurrency(stats.entradas)}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Total de Saídas</div>
    <div class="summary-value sai-val">${formatCurrency(stats.saidas)}</div>
  </div>
  <div class="summary-item">
    <div class="summary-label">Saldo do Período</div>
    <div class="summary-value sal-val">${formatCurrency(stats.saldo)}</div>
  </div>
</div>

<!-- Table -->
<div class="content">
  <div class="section-title">Lançamentos — ${lancamentos.length} registros</div>
  <table>
    <thead>
      <tr>
        <th>Data</th><th>Descrição / Membro</th><th>Categoria</th>
        <th>Tipo</th><th>Forma</th><th style="text-align:right">Valor</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>

<!-- Certification -->
<div class="cert">
  <div class="cert-title">Declaração de Autenticidade</div>
  <div class="cert-text">Declaro que as informações contidas neste relatório são fiéis aos registros financeiros de <strong>${igrejaNome || "nossa instituição"}</strong>, referentes ao período de <strong>${periodoLabel}</strong>, totalizando entradas de <strong>${formatCurrency(stats.entradas)}</strong>, saídas de <strong>${formatCurrency(stats.saidas)}</strong> e saldo de <strong>${formatCurrency(stats.saldo)}</strong>.</div>
</div>

<!-- Footer -->
<div class="footer">
  <div class="footer-left"><span class="footer-church">${igrejaNome || "IPVB"}</span> · Documento gerado automaticamente pelo sistema de gestão</div>
  <div class="footer-right">Página 1 · ${hoje}</div>
</div>

</body></html>`)
    win.document.close()
    win.print()
    setExportando(false)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controle financeiro da igreja</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarPDF} disabled={exportando || lancamentos.length === 0} className="gap-2">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Exportar PDF
          </Button>
          <Button onClick={() => setModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["hoje","semana","mes","ano"] as const).map(p => (
          <button key={p}
            onClick={() => { const r = presetRange(p); setActivePreset(p); setDateFrom(r.from); setDateTo(r.to) }}
            className={`h-8 px-3 rounded-md text-sm font-medium border transition-colors ${activePreset === p ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {{ hoje: "Hoje", semana: "Esta semana", mes: "Este mês", ano: "Este ano" }[p]}
          </button>
        ))}
        <div className="h-6 w-px bg-border mx-1" />
        <div className="flex flex-wrap items-center gap-1.5 bg-background border border-input rounded-md px-2.5 py-1 min-h-8">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input type="date" value={dateFrom} onChange={e => { setActivePreset(""); setDateFrom(e.target.value) }}
            className="bg-transparent text-sm border-none outline-none min-w-0 w-32" />
          <span className="text-muted-foreground text-xs">–</span>
          <input type="date" value={dateTo} onChange={e => { setActivePreset(""); setDateTo(e.target.value) }}
            className="bg-transparent text-sm border-none outline-none min-w-0 w-32" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Entradas", value: stats.entradas, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: "Total Saídas",   value: stats.saidas,   icon: TrendingDown, color: "text-red-600",   bg: "bg-red-500/10" },
          { label: "Saldo",          value: stats.saldo,    icon: Wallet, color: stats.saldo >= 0 ? "text-blue-600" : "text-red-600", bg: "bg-blue-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tabular-nums ${color}`}>{formatCurrency(value)}</div>
              <p className="text-xs text-muted-foreground mt-1">{periodLabel(dateFrom, dateTo)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{chartTitle[activePreset] ?? `Entradas vs Saídas — ${periodLabel(dateFrom, dateTo)}`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
          ) : chartData.every(p => p.entradas === 0 && p.saidas === 0) ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">Sem dados para exibir</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={48} />
                <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === "entradas" ? "Entradas" : "Saídas"]}
                  contentStyle={{ fontSize: 13, borderRadius: 8 }} />
                <Legend formatter={v => v === "entradas" ? "Entradas" : "Saídas"} iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="entradas" fill="#16a34a" radius={[4,4,0,0]} maxBarSize={40} />
                <Bar dataKey="saidas"   fill="#dc2626" radius={[4,4,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Filter + table */}
      <div className="flex gap-2 flex-wrap">
        {(["","entrada","saida"] as const).map(t => (
          <Button key={t} variant={filtroTipo === t ? "default" : "outline"} size="sm" onClick={() => setFiltroTipo(t)}>
            {t === "" ? "Todos" : t === "entrada" ? "Entradas" : "Saídas"}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Lançamentos — <span className="font-normal text-muted-foreground">{periodLabel(dateFrom, dateTo)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : lancamentos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum lançamento neste período.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="py-2 pr-4 font-medium text-xs uppercase tracking-wider">Data</th>
                    <th className="py-2 pr-4 font-medium text-xs uppercase tracking-wider">Descrição</th>
                    <th className="py-2 pr-4 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Categoria</th>
                    <th className="py-2 pr-4 font-medium text-xs uppercase tracking-wider">Tipo</th>
                    <th className="py-2 pr-4 font-medium text-xs uppercase tracking-wider hidden md:table-cell">Forma</th>
                    <th className="py-2 pr-4 font-medium text-xs uppercase tracking-wider text-right">Valor</th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map(l => {
                    const cat = l.categorias_financeiras
                    return (
                      <tr key={l.id} className="border-b hover:bg-muted/30">
                        <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">
                          {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-2.5 pr-4">
                          <p className="font-medium">{l.descricao}</p>
                          {l.membros?.nome && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <UserCircle className="h-3 w-3" /> {l.membros.nome}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 hidden md:table-cell">
                          {cat ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                              style={{ backgroundColor: cat.cor ? `${cat.cor}22` : undefined, color: cat.cor ?? undefined, outline: cat.cor ? `1px solid ${cat.cor}55` : undefined }}>
                              {cat.nome}
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge variant={l.tipo === "entrada" ? "default" : "destructive"} className="text-xs">
                            {l.tipo === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 capitalize text-muted-foreground hidden md:table-cell">{l.forma_pagamento}</td>
                        <td className={`py-2.5 pr-4 text-right font-semibold whitespace-nowrap tabular-nums ${l.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                          {l.tipo === "saida" ? "−" : "+"}{formatCurrency(l.valor)}
                        </td>
                        <td className="py-2.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(l.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle>Excluir lançamento?</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação é irreversível.</p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New lancamento modal */}
      <Dialog open={modalOpen} onOpenChange={open => { if (!open) { setModalOpen(false); setForm(EMPTY_FORM); setMembroNomeSelecionado("") } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lançamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tipo */}
            <div className="flex gap-2">
              <Button type="button" variant={form.tipo === "entrada" ? "default" : "outline"} className="flex-1 gap-2" onClick={() => setTipo("entrada")}>
                <TrendingUp className="h-4 w-4" /> Entrada
              </Button>
              <Button type="button" variant={form.tipo === "saida" ? "destructive" : "outline"} className="flex-1 gap-2" onClick={() => setTipo("saida")}>
                <TrendingDown className="h-4 w-4" /> Saída
              </Button>
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <Label>Categoria <span className="text-destructive">*</span></Label>
              <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value, membro_id: "" }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Selecione uma categoria…</option>
                {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                {categoriasFiltradas.length === 0 && <option disabled>Nenhuma categoria</option>}
              </select>
            </div>

            {/* Membro dizimista (only when Dízimos category) */}
            {isDizimo && (
              <div className="space-y-1.5 rounded-lg border border-[#C1BC7A]/30 bg-[#C1BC7A]/5 p-3">
                <Label className="flex items-center gap-2 text-[#8a8345]">
                  <UserCircle className="h-4 w-4" />
                  Membro Dizimista <span className="text-destructive">*</span>
                </Label>
                <MemberSearch
                  membros={membros}
                  value={form.membro_id}
                  onChange={(id, nome) => { setForm(f => ({ ...f, membro_id: id })); setMembroNomeSelecionado(nome) }}
                />
                <p className="text-xs text-muted-foreground">Vincule este dízimo ao membro responsável pelo pagamento</p>
              </div>
            )}

            {/* Data + Valor */}
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <Label>Data <span className="text-destructive">*</span></Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$) <span className="text-destructive">*</span></Label>
                <Input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label>Descrição <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Dízimos do culto de domingo…" />
            </div>

            {/* Forma + Status */}
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <Label>Forma de pagamento</Label>
                <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-ring">
                  {FORMAS.map(fp => <option key={fp} value={fp} className="capitalize">{fp}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="efetivado">Efetivado</option>
                  <option value="pendente">Pendente</option>
                  <option value="agendado">Agendado</option>
                </select>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label>Observações <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Input value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informação adicional" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); setForm(EMPTY_FORM); setMembroNomeSelecionado("") }} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
