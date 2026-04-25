"use client"

import { useState } from "react"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit, Eye, Search, ChevronLeft, ChevronRight, Phone, Calendar } from "lucide-react"
import Link from "next/link"

interface MembrosTableProps {
  membros: any[]
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ativo:    { label: "Ativo",     className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  inativo:  { label: "Inativo",   className: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20" },
  visitante:{ label: "Visitante", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
}

const AVATAR_COLORS = [
  "#8a8345","#C1BC7A","#1d4ed8","#7c3aed","#b45309","#0f766e","#9f1239","#a8a35e",
]
function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function getInitials(name: string) {
  const p = name.trim().split(" ").filter(Boolean)
  return p.length === 1 ? p[0].substring(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

const PAGE_SIZE = 5

export function MembrosTable({ membros }: MembrosTableProps) {
  const [query, setQuery]   = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage]     = useState(1)

  const filtered = membros.filter(m => {
    const matchName   = m.nome?.toLowerCase().includes(query.toLowerCase())
    const matchStatus = !status || m.status === status
    return matchName && matchStatus
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeP      = Math.min(page, totalPages)
  const slice      = filtered.slice((safeP - 1) * PAGE_SIZE, safeP * PAGE_SIZE)

  function goPage(p: number) {
    setPage(Math.max(1, Math.min(p, totalPages)))
  }

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nome…"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            className="pl-9 h-9 bg-background"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["", "ativo", "inativo", "visitante"] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`h-8 px-3 rounded-md text-xs font-medium border transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background border-input text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {s === "" ? "Todos" : s === "ativo" ? "Ativos" : s === "inativo" ? "Inativos" : "Visitantes"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Membro</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Telefone</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Entrada</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {query || status ? "Nenhum membro encontrado com os filtros aplicados." : "Nenhum membro cadastrado."}
                </td>
              </tr>
            ) : (
              slice.map((m) => {
                const st = STATUS_CONFIG[m.status] ?? { label: m.status, className: "bg-muted text-muted-foreground" }
                return (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ backgroundColor: avatarColor(m.nome) }}
                        >
                          {getInitials(m.nome)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[180px]">{m.nome}</p>
                          {m.email && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{m.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      {m.telefone ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {m.telefone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.className}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      {m.data_entrada ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(m.data_entrada)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex justify-end gap-1">
                        <Link href={`/membros/${m.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Ver detalhes">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/membros/${m.id}/editar`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Editar">
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-muted-foreground">
            Exibindo {((safeP - 1) * PAGE_SIZE) + 1}–{Math.min(safeP * PAGE_SIZE, filtered.length)} de {filtered.length} membros
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => goPage(safeP - 1)}
              disabled={safeP === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safeP) <= 1)
              .reduce<(number | "...")[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("...")
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={safeP === p ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 rounded-lg text-xs"
                    onClick={() => goPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => goPage(safeP + 1)}
              disabled={safeP === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
