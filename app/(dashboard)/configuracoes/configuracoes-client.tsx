"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Building2, User, Loader2, Pencil, Plus, X, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

interface Props {
  profile: any
}

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

interface CultoRegular {
  id?: string
  nome: string
  dia_semana: number
  horario: string
  tipo: string
}

const EMPTY_CULTO: CultoRegular = { nome: "", dia_semana: 0, horario: "19:00", tipo: "semana" }

export function ConfiguracoesClient({ profile }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  // Igreja
  const [igrejaOpen, setIgrejaOpen] = useState(false)
  const [igrejaLoading, setIgrejaLoading] = useState(false)
  const [igrejaForm, setIgrejaForm] = useState({
    nome: profile?.igreja?.nome || "",
    tipo: profile?.igreja?.tipo || "sede",
    email: profile?.igreja?.email || "",
    telefone: profile?.igreja?.telefone || "",
  })
  const [cultos, setCultos] = useState<CultoRegular[]>([])
  const [cultosLoading, setCultosLoading] = useState(false)

  // Perfil
  const [perfilOpen, setPerfilOpen] = useState(false)
  const [perfilLoading, setPerfilLoading] = useState(false)
  const [perfilForm, setPerfilForm] = useState({
    nome: profile?.nome || "",
    telefone: profile?.telefone || "",
  })

  // Senha
  const [senhaOpen, setSenhaOpen] = useState(false)
  const [senhaLoading, setSenhaLoading] = useState(false)
  const [senhaForm, setSenhaForm] = useState({ nova: "", confirmar: "" })

  async function openIgreja() {
    setIgrejaOpen(true)
    if (!profile?.igreja?.id) return
    setCultosLoading(true)
    try {
      const res = await fetch(`/api/igrejas/cultos-regulares?igreja_id=${profile.igreja.id}`)
      const json = await res.json()
      setCultos(json.data ?? [])
    } catch {
      setCultos([])
    } finally {
      setCultosLoading(false)
    }
  }

  function addCulto() {
    setCultos(prev => [...prev, { ...EMPTY_CULTO }])
  }

  function removeCulto(idx: number) {
    setCultos(prev => prev.filter((_, i) => i !== idx))
  }

  function updateCulto(idx: number, field: keyof CultoRegular, value: string | number) {
    setCultos(prev => prev.map((c, i) => {
      if (i !== idx) return c
      if (field === "dia_semana") {
        const dow = Number(value)
        const autoNome = dow === 0 ? "Culto de Domingo" : `Culto de ${DIAS_SEMANA[dow]}`
        return { ...c, dia_semana: dow, nome: c.nome || autoNome }
      }
      return { ...c, [field]: value }
    }))
  }

  const saveIgreja = async () => {
    if (!profile?.igreja?.id) return
    setIgrejaLoading(true)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("igrejas")
        .update({
          nome: igrejaForm.nome,
          tipo: igrejaForm.tipo,
          email: igrejaForm.email || null,
          telefone: igrejaForm.telefone || null,
        })
        .eq("id", profile.igreja.id)

      if (error) throw error

      // Salva cultos_regulares
      await fetch("/api/igrejas/cultos-regulares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igreja_id: profile.igreja.id, cultos }),
      })

      toast({ title: "Igreja atualizada com sucesso." })
      setIgrejaOpen(false)
      router.refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setIgrejaLoading(false)
    }
  }

  const savePerfil = async () => {
    setPerfilLoading(true)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ nome: perfilForm.nome, telefone: perfilForm.telefone || null })
        .eq("id", profile.id)

      if (error) throw error
      toast({ title: "Perfil atualizado com sucesso." })
      setPerfilOpen(false)
      router.refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setPerfilLoading(false)
    }
  }

  const saveSenha = async () => {
    if (senhaForm.nova !== senhaForm.confirmar) {
      toast({ variant: "destructive", title: "As senhas não coincidem." })
      return
    }
    if (senhaForm.nova.length < 6) {
      toast({ variant: "destructive", title: "A senha deve ter no mínimo 6 caracteres." })
      return
    }
    setSenhaLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: senhaForm.nova })
      if (error) throw error
      toast({ title: "Senha alterada com sucesso." })
      setSenhaOpen(false)
      setSenhaForm({ nova: "", confirmar: "" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message })
    } finally {
      setSenhaLoading(false)
    }
  }

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    pastor: "Pastor",
    tesoureiro: "Tesoureiro",
    secretaria: "Secretaria",
    lider_ministerio: "Líder de Ministério",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Igreja */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Igreja</CardTitle>
                <CardDescription className="text-xs">Dados da instituição</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openIgreja}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{profile?.igreja?.nome || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <span className="font-medium capitalize">{profile?.igreja?.tipo || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">{profile?.igreja?.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Telefone</span>
              <span className="font-medium">{profile?.igreja?.telefone || "—"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Perfil */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Meu Perfil</CardTitle>
                <CardDescription className="text-xs">Suas informações</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPerfilOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{profile?.nome || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium">{profile?.email || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Função</span>
              <span className="font-medium">{roleLabels[profile?.role] || profile?.role || "—"}</span>
            </div>
            <div className="pt-1">
              <Button variant="outline" size="sm" className="h-8 text-xs w-full" onClick={() => setSenhaOpen(true)}>
                Alterar senha
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog — Editar Igreja */}
      <Dialog open={igrejaOpen} onOpenChange={setIgrejaOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Igreja</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Dados básicos */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Igreja</p>
              <div className="space-y-1.5">
                <Label htmlFor="ig-nome">Nome</Label>
                <Input id="ig-nome" value={igrejaForm.nome}
                  onChange={e => setIgrejaForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ig-tipo">Tipo</Label>
                  <select id="ig-tipo" value={igrejaForm.tipo}
                    onChange={e => setIgrejaForm(p => ({ ...p, tipo: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="sede">Sede</option>
                    <option value="congregacao">Congregação</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ig-tel">Telefone</Label>
                  <Input id="ig-tel" value={igrejaForm.telefone}
                    onChange={e => setIgrejaForm(p => ({ ...p, telefone: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ig-email">E-mail</Label>
                <Input id="ig-email" type="email" value={igrejaForm.email}
                  onChange={e => setIgrejaForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>

            {/* Dias de Culto */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dias de Culto</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Usados para gerar as escalas automaticamente</p>
                </div>
                <button
                  onClick={addCulto}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>

              {cultosLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : cultos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center">
                  <Clock className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">Nenhum culto cadastrado.</p>
                  <button onClick={addCulto} className="mt-1.5 text-xs text-primary hover:underline">+ Adicionar culto</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {cultos.map((c, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center bg-muted/40 rounded-lg px-3 py-2">
                      <select
                        value={c.dia_semana}
                        onChange={e => updateCulto(idx, "dia_semana", Number(e.target.value))}
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        {DIAS_SEMANA.map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        value={c.horario}
                        onChange={e => updateCulto(idx, "horario", e.target.value)}
                        className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm"
                      />
                      <Input
                        value={c.nome}
                        onChange={e => updateCulto(idx, "nome", e.target.value)}
                        placeholder="Nome (ex: Domingo Manhã)"
                        className="h-8 text-sm w-40"
                      />
                      <button
                        onClick={() => removeCulto(idx)}
                        className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIgrejaOpen(false)}>Cancelar</Button>
            <Button onClick={saveIgreja} disabled={igrejaLoading}>
              {igrejaLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Editar Perfil */}
      <Dialog open={perfilOpen} onOpenChange={setPerfilOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pf-nome">Nome</Label>
              <Input id="pf-nome" value={perfilForm.nome}
                onChange={e => setPerfilForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pf-tel">Telefone</Label>
              <Input id="pf-tel" value={perfilForm.telefone}
                onChange={e => setPerfilForm(p => ({ ...p, telefone: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPerfilOpen(false)}>Cancelar</Button>
            <Button onClick={savePerfil} disabled={perfilLoading}>
              {perfilLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Alterar Senha */}
      <Dialog open={senhaOpen} onOpenChange={setSenhaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sn-nova">Nova senha</Label>
              <Input id="sn-nova" type="password" value={senhaForm.nova}
                onChange={e => setSenhaForm(p => ({ ...p, nova: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sn-conf">Confirmar senha</Label>
              <Input id="sn-conf" type="password" value={senhaForm.confirmar}
                onChange={e => setSenhaForm(p => ({ ...p, confirmar: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenhaOpen(false)}>Cancelar</Button>
            <Button onClick={saveSenha} disabled={senhaLoading}>
              {senhaLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
