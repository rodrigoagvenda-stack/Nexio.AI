"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { DollarSign, TrendingUp, TrendingDown, Wallet, Plus, X, Loader2, FileDown, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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
  categorias_financeiras?: { nome: string; cor: string }
}

interface Categoria {
  id: string
  nome: string
  tipo: string
  cor: string
}

interface MonthlyPoint {
  mes: string       // e.g. "Jan", "Fev" — short label from API
  entradas: number
  saidas: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAS = ["dinheiro", "pix", "transferencia", "debito", "credito", "boleto", "cheque"]

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

const currentYear = new Date().getFullYear()
const ANOS = [currentYear - 2, currentYear - 1, currentYear]

const EMPTY_FORM = {
  tipo: "entrada" as "entrada" | "saida",
  data: new Date().toISOString().split("T")[0],
  categoria_id: "",
  descricao: "",
  valor: "",
  forma_pagamento: "pix",
  status: "efetivado",
  observacoes: "",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" for the first day of a given month/year */
function firstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`
}

/** Returns "YYYY-MM-DD" for the last day of a given month/year */
function lastDay(year: number, month: number): string {
  const d = new Date(year, month, 0) // month 0-indexed trick: day 0 = last day of prev month
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const { toast } = useToast()
  const supabase = createClient()

  // Month/year filter — defaults to current month
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1) // 1–12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())

  const [igrejaId, setIgrejaId] = useState("")
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [stats, setStats] = useState({ entradas: 0, saidas: 0, saldo: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filtroTipo, setFiltroTipo] = useState("")
  const [exportando, setExportando] = useState(false)

  // Chart data
  const [chartData, setChartData] = useState<MonthlyPoint[]>([])
  const [chartLoading, setChartLoading] = useState(false)

  // ── Initial load: categories + current user's igreja_id ───────────────────
  useEffect(() => {
    fetch("/api/financeiro/categorias")
      .then(r => r.json())
      .then(j => setCategorias(j.data ?? []))
      .catch(() => {})

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase as any)
        .from("profiles")
        .select("igreja_id")
        .eq("id", user.id)
        .single()
        .then(({ data }: any) => {
          if (data?.igreja_id) {
            setIgrejaId(data.igreja_id)
          }
        })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fetch lancamentos whenever igrejaId, month, year or filtroTipo change ──
  const fetchLancamentos = useCallback(
    async (iid: string, tipo: string, month: number, year: number) => {
      if (!iid) return
      setLoading(true)
      try {
        const params = new URLSearchParams({
          igreja_id: iid,
          pageSize: "200",
          data_inicio: firstDay(year, month),
          data_fim: lastDay(year, month),
        })
        if (tipo) params.set("tipo", tipo)
        const res = await fetch(`/api/financeiro/lancamentos?${params}`)
        const json = await res.json()
        const data: Lancamento[] = json.data ?? []
        setLancamentos(data)
        const entradas = data
          .filter(l => l.tipo === "entrada")
          .reduce((s, l) => s + Number(l.valor), 0)
        const saidas = data
          .filter(l => l.tipo === "saida")
          .reduce((s, l) => s + Number(l.valor), 0)
        setStats({ entradas, saidas, saldo: entradas - saidas })
      } catch {
        toast({ variant: "destructive", title: "Erro ao carregar lançamentos" })
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useEffect(() => {
    if (igrejaId) {
      fetchLancamentos(igrejaId, filtroTipo, selectedMonth, selectedYear)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igrejaId, filtroTipo, selectedMonth, selectedYear])

  // ── Fetch chart data (last 6 months) whenever igrejaId changes ────────────
  useEffect(() => {
    if (!igrejaId) return
    setChartLoading(true)
    fetch(`/api/financeiro/mensal?igreja_id=${igrejaId}`)
      .then(r => r.json())
      .then(j => setChartData(j.data ?? []))
      .catch(() => {})
      .finally(() => setChartLoading(false))
  }, [igrejaId])

  // ── Form helpers ──────────────────────────────────────────────────────────
  function setTipo(tipo: "entrada" | "saida") {
    setForm(f => ({ ...f, tipo, categoria_id: "" }))
  }

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)

  // ── Save new lancamento ───────────────────────────────────────────────────
  async function handleSave() {
    if (!form.categoria_id) {
      toast({ variant: "destructive", title: "Selecione uma categoria" })
      return
    }
    if (!form.valor || !form.data) {
      toast({ variant: "destructive", title: "Preencha valor e data" })
      return
    }
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
          descricao:
            form.descricao ||
            categorias.find(c => c.id === form.categoria_id)?.nome ||
            "",
          valor: parseFloat(String(form.valor).replace(",", ".")),
          forma_pagamento: form.forma_pagamento,
          status: form.status,
          observacoes: form.observacoes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast({ title: "Lançamento registrado!" })
      setModalOpen(false)
      setForm(EMPTY_FORM)
      fetchLancamentos(igrejaId, filtroTipo, selectedMonth, selectedYear)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e.message })
    } finally {
      setSaving(false)
    }
  }

  // ── Delete lancamento ─────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento?")) return
    try {
      await fetch(`/api/financeiro/lancamentos/${id}`, { method: "DELETE" })
      fetchLancamentos(igrejaId, filtroTipo, selectedMonth, selectedYear)
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir" })
    }
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  function exportarPDF() {
    setExportando(true)
    const win = window.open("", "_blank")
    if (!win) {
      setExportando(false)
      return
    }
    const periodoLabel = `${MESES[selectedMonth - 1]} ${selectedYear}`
    const rows = lancamentos
      .map(
        l => `
      <tr>
        <td>${new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</td>
        <td>${l.descricao}</td>
        <td>${l.categorias_financeiras?.nome ?? "—"}</td>
        <td style="color:${l.tipo === "entrada" ? "green" : "red"}">${l.tipo === "entrada" ? "Entrada" : "Saída"}</td>
        <td style="text-transform:capitalize">${l.forma_pagamento}</td>
        <td style="text-align:right;font-weight:bold;color:${l.tipo === "entrada" ? "green" : "red"}">${l.tipo === "saida" ? "−" : "+"}${formatCurrency(l.valor)}</td>
      </tr>`
      )
      .join("")
    win.document.write(`<html><head><title>Relatório Financeiro — ${periodoLabel}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h2{margin-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#085832;color:#fff;padding:8px;text-align:left}
      td{padding:6px 8px;border-bottom:1px solid #eee}
      .sum{display:flex;gap:32px;margin:16px 0;font-size:14px}</style></head><body>
      <h2>Relatório Financeiro — ${periodoLabel}</h2>
      <p style="color:#666">Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>
      <div class="sum">
        <span>✅ Entradas: <strong style="color:green">${formatCurrency(stats.entradas)}</strong></span>
        <span>❌ Saídas: <strong style="color:red">${formatCurrency(stats.saidas)}</strong></span>
        <span>💰 Saldo: <strong>${formatCurrency(stats.saldo)}</strong></span>
      </div>
      <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th>Forma</th><th>Valor</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`)
    win.document.close()
    win.print()
    setExportando(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Financeiro</h2>
          <p className="text-muted-foreground">Controle financeiro da igreja</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportarPDF}
            disabled={exportando || lancamentos.length === 0}
          >
            {exportando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Exportar PDF
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {/* Month / Year filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Período:</span>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {MESES.map((nome, idx) => (
            <option key={idx + 1} value={idx + 1}>
              {nome}
            </option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ANOS.map(ano => (
            <option key={ano} value={ano}>
              {ano}
            </option>
          ))}
        </select>
      </div>

      {/* Stats cards — reflect selected month */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.entradas)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {MESES[selectedMonth - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.saidas)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {MESES[selectedMonth - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                stats.saldo >= 0 ? "text-blue-600" : "text-red-600"
              }`}
            >
              {formatCurrency(stats.saldo)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {MESES[selectedMonth - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly bar chart — last 6 months */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entradas vs Saídas — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Sem dados para exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                  width={48}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "entradas" ? "Entradas" : "Saídas",
                  ]}
                  contentStyle={{ fontSize: 13, borderRadius: 8 }}
                />
                <Legend
                  formatter={v => (v === "entradas" ? "Entradas" : "Saídas")}
                  iconType="circle"
                  iconSize={10}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="entradas" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="saidas" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Type filter + table */}
      <div className="flex gap-2">
        {(["", "entrada", "saida"] as const).map(t => (
          <Button
            key={t}
            variant={filtroTipo === t ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroTipo(t)}
          >
            {t === "" ? "Todos" : t === "entrada" ? "Entradas" : "Saídas"}
          </Button>
        ))}
      </div>

      {/* Lancamentos table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Lançamentos —{" "}
            <span className="font-normal text-muted-foreground">
              {MESES[selectedMonth - 1]} {selectedYear}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lancamentos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum lançamento neste período. Clique em "Novo Lançamento" para começar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 pr-4 font-medium">Descrição</th>
                    <th className="py-2 pr-4 font-medium">Categoria</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Forma</th>
                    <th className="py-2 pr-4 font-medium text-right">Valor</th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.map(l => {
                    const cat = l.categorias_financeiras
                    return (
                      <tr key={l.id} className="border-b hover:bg-muted/40">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-2 pr-4">{l.descricao}</td>
                        <td className="py-2 pr-4">
                          {cat ? (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                              style={{
                                backgroundColor: cat.cor ? `${cat.cor}22` : undefined,
                                color: cat.cor ?? undefined,
                                ringColor: cat.cor ? `${cat.cor}55` : undefined,
                              }}
                            >
                              {cat.nome}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={l.tipo === "entrada" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {l.tipo === "entrada" ? "Entrada" : "Saída"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 capitalize text-muted-foreground">
                          {l.forma_pagamento}
                        </td>
                        <td
                          className={`py-2 pr-4 text-right font-semibold whitespace-nowrap ${
                            l.tipo === "entrada" ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {l.tipo === "saida" ? "−" : "+"}
                          {formatCurrency(l.valor)}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(l.id)}
                          >
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

      {/* New lancamento modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold">Novo Lançamento</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              {/* Tipo toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.tipo === "entrada" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setTipo("entrada")}
                >
                  <TrendingUp className="mr-2 h-4 w-4" /> Entrada
                </Button>
                <Button
                  type="button"
                  variant={form.tipo === "saida" ? "destructive" : "outline"}
                  className="flex-1"
                  onClick={() => setTipo("saida")}
                >
                  <TrendingDown className="mr-2 h-4 w-4" /> Saída
                </Button>
              </div>

              {/* Categoria */}
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <select
                  value={form.categoria_id}
                  onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categoriasFiltradas.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                  {categoriasFiltradas.length === 0 && (
                    <option disabled>Nenhuma categoria cadastrada</option>
                  )}
                </select>
              </div>

              {/* Data + Valor */}
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$) *</Label>
                  <Input
                    value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Descrição (optional) */}
              <div className="space-y-2">
                <Label>
                  Descrição{" "}
                  <span className="text-muted-foreground text-xs">(opcional)</span>
                </Label>
                <Input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Dízimos do culto de domingo..."
                />
              </div>

              {/* Forma de pagamento + Status */}
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <select
                    value={form.forma_pagamento}
                    onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
                  >
                    {FORMAS.map(fp => (
                      <option key={fp} value={fp} className="capitalize">
                        {fp}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="efetivado">Efetivado</option>
                    <option value="pendente">Pendente</option>
                    <option value="agendado">Agendado</option>
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  value={form.observacoes}
                  onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
