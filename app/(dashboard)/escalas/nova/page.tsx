"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, ArrowLeft, Building2 } from "lucide-react"
import Link from "next/link"

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

interface Igreja {
  id: string
  nome: string
  tipo: "sede" | "congregacao"
}

export default function NovaEscalaPage() {
  const router = useRouter()
  const { toast } = useToast()

  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [igrejaId, setIgrejaId] = useState("")
  const [igrejas, setIgrejas] = useState<Igreja[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingIgrejas, setLoadingIgrejas] = useState(true)

  const anos = Array.from({ length: 3 }, (_, i) => now.getFullYear() + i)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      ;(supabase as any)
        .from("igrejas")
        .select("id, nome, tipo")
        .order("tipo", { ascending: false }) // sede first
        .order("nome")
        .then(({ data }: any) => {
          const list: Igreja[] = data ?? []
          setIgrejas(list)
          if (list.length === 1) setIgrejaId(list[0].id)
        })
        .finally(() => setLoadingIgrejas(false))
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!igrejaId) {
      toast({ variant: "destructive", title: "Selecione uma igreja" })
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/escalas/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, ano, igreja_id: igrejaId }),
      })

      const json = await res.json()

      if (res.ok && json.data?.id) {
        toast({ title: "Escala gerada com sucesso!" })
        router.push(`/escalas/${json.data.id}`)
        return
      }

      // Fallback: create a blank escala
      const blankRes = await fetch("/api/escalas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes, ano,
          igreja_id: igrejaId,
          status: "rascunho",
          data_geracao: new Date().toISOString(),
        }),
      })

      const blankJson = await blankRes.json()
      if (!blankRes.ok) throw new Error(blankJson.error || "Erro ao criar escala")

      toast({ title: "Escala criada. Adicione os cultos manualmente." })
      router.push(`/escalas/${blankJson.data.id}`)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const igrejaSelected = igrejas.find(i => i.id === igrejaId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/escalas">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Nova Escala</h1>
          <p className="text-sm text-muted-foreground">Gere a escala de um mês automaticamente</p>
        </div>
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">Selecione o período e a igreja</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Igreja */}
            <div className="space-y-1.5">
              <Label>Igreja *</Label>
              {loadingIgrejas ? (
                <div className="flex items-center gap-2 h-9 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando igrejas...
                </div>
              ) : igrejas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma igreja cadastrada.</p>
              ) : (
                <div className="grid gap-2">
                  {igrejas.map(ig => (
                    <button
                      key={ig.id}
                      type="button"
                      onClick={() => setIgrejaId(ig.id)}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                        igrejaId === ig.id
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        igrejaId === ig.id ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <Building2 className={`h-4 w-4 ${igrejaId === ig.id ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{ig.nome}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">{ig.tipo}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mês + Ano */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mes">Mês</Label>
                <select
                  id="mes"
                  value={mes}
                  onChange={e => setMes(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {MESES.map((nome, i) => (
                    <option key={i + 1} value={i + 1}>{nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ano">Ano</Label>
                <select
                  id="ano"
                  value={ano}
                  onChange={e => setAno(Number(e.target.value))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {anos.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !igrejaId}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</>
              ) : (
                `Gerar Escala${igrejaSelected ? ` — ${igrejaSelected.nome}` : ""}`
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
