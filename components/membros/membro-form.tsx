"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, Camera, Upload, X, Loader2, Search } from "lucide-react"
import Link from "next/link"

interface MembroFormData {
  nome: string
  cpf: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: "M" | "F" | ""
  estado_civil: "solteiro" | "casado" | "divorciado" | "viuvo" | ""
  conjuge_id: string
  cargo: string
  dizimista: boolean
  data_batismo: string
  data_entrada: string
  status: "ativo" | "inativo" | "visitante"
  observacoes: string
  foto_url: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

interface MembroLookup {
  id: string
  nome: string
}

export function MembroForm({ initialData, membroId }: { initialData?: Partial<MembroFormData>; membroId?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [membrosLookup, setMembrosLookup] = useState<MembroLookup[]>([])
  const [conjugeSearch, setConjugeSearch] = useState("")
  const [conjugeNome, setConjugeNome] = useState("")
  const [showConjugeDrop, setShowConjugeDrop] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<MembroFormData>({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    data_nascimento: "",
    sexo: "",
    estado_civil: "",
    conjuge_id: "",
    cargo: "",
    dizimista: false,
    data_batismo: "",
    data_entrada: new Date().toISOString().split("T")[0],
    status: "ativo",
    observacoes: "",
    foto_url: "",
    rua: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    ...initialData,
  })

  // Busca membros para lookup de cônjuge
  useEffect(() => {
    fetch("/api/membros?pageSize=200")
      .then(r => r.json())
      .then(d => setMembrosLookup((d.data ?? []).filter((m: any) => m.id !== membroId)))
      .catch(() => {})
  }, [membroId])

  const conjugeFiltrado = membrosLookup.filter(m =>
    m.nome.toLowerCase().includes(conjugeSearch.toLowerCase())
  ).slice(0, 8)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  // ---- FOTO ----
  async function uploadFoto(file: File) {
    setUploadingFoto(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (membroId) fd.append("membroId", membroId)
      const res = await fetch("/api/membros/upload-foto", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFormData(prev => ({ ...prev, foto_url: data.foto_url }))
    } catch (e: any) {
      alert(e.message)
    } finally {
      setUploadingFoto(false)
    }
  }

  async function openCamera() {
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      alert("Não foi possível acessar a câmera")
      setCameraOpen(false)
    }
  }

  async function capturePhoto() {
    if (!videoRef.current) return
    const canvas = document.createElement("canvas")
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext("2d")?.drawImage(videoRef.current, 0, 0)
    canvas.toBlob(async blob => {
      if (!blob) return
      closeCamera()
      const file = new File([blob], "foto.jpg", { type: "image/jpeg" })
      await uploadFoto(file)
    }, "image/jpeg", 0.9)
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  // ---- SUBMIT ----
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        nome: formData.nome,
        cpf: formData.cpf || null,
        email: formData.email || null,
        telefone: formData.telefone || null,
        data_nascimento: formData.data_nascimento || null,
        sexo: formData.sexo || null,
        estado_civil: formData.estado_civil || null,
        conjuge_id: formData.conjuge_id || null,
        cargo: formData.cargo || null,
        dizimista: formData.dizimista,
        data_batismo: formData.data_batismo || null,
        data_entrada: formData.data_entrada,
        status: formData.status,
        observacoes: formData.observacoes || null,
        foto_url: formData.foto_url || null,
        endereco: formData.rua
          ? { rua: formData.rua, numero: formData.numero, complemento: formData.complemento, bairro: formData.bairro, cidade: formData.cidade, estado: formData.estado, cep: formData.cep }
          : null,
      }

      const url = membroId ? `/api/membros/${membroId}` : "/api/membros"
      const method = membroId ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Erro ao salvar")
      }

      router.push("/membros")
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao salvar membro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Modal câmera */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-background rounded-lg overflow-hidden max-w-sm w-full">
            <video ref={videoRef} autoPlay playsInline className="w-full aspect-square object-cover" />
            <div className="flex gap-3 p-4">
              <Button className="flex-1" onClick={capturePhoto}>
                <Camera className="mr-2 h-4 w-4" /> Tirar Foto
              </Button>
              <Button variant="outline" onClick={closeCamera}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Link href="/membros">
            <Button type="button" variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          </Link>
        </div>

        {/* Foto */}
        <Card>
          <CardHeader>
            <CardTitle>Foto do Membro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Preview */}
              <div className="w-24 h-24 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                {uploadingFoto ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : formData.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.foto_url} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-muted-foreground">👤</span>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFoto}
                  >
                    <Upload className="mr-2 h-4 w-4" /> Enviar arquivo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openCamera}
                    disabled={uploadingFoto}
                  >
                    <Camera className="mr-2 h-4 w-4" /> Câmera
                  </Button>
                  {formData.foto_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData(p => ({ ...p, foto_url: "" }))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP — máx. 3MB</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f); e.target.value = "" }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dados Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Pessoais</CardTitle>
            <CardDescription>Informações básicas do membro</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input id="nome" name="nome" value={formData.nome} onChange={handleChange} required placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input id="cpf" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input id="data_nascimento" name="data_nascimento" type="date" value={formData.data_nascimento} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sexo">Sexo</Label>
                <select id="sexo" name="sexo" value={formData.sexo} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado_civil">Estado Civil</Label>
                <select id="estado_civil" name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                </select>
              </div>
            </div>

            {/* Cônjuge — aparece só se casado */}
            {formData.estado_civil === "casado" && (
              <div className="space-y-2 relative">
                <Label>Cônjuge (membro da igreja)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={conjugeNome || conjugeSearch}
                    onChange={e => {
                      setConjugeSearch(e.target.value)
                      setConjugeNome("")
                      setFormData(p => ({ ...p, conjuge_id: "" }))
                      setShowConjugeDrop(true)
                    }}
                    onFocus={() => setShowConjugeDrop(true)}
                    placeholder="Buscar membro..."
                    className="pl-9"
                  />
                  {formData.conjuge_id && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => { setFormData(p => ({ ...p, conjuge_id: "" })); setConjugeNome(""); setConjugeSearch("") }}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
                {showConjugeDrop && conjugeSearch && !formData.conjuge_id && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-lg max-h-48 overflow-y-auto">
                    {conjugeFiltrado.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Nenhum membro encontrado</p>
                    ) : (
                      conjugeFiltrado.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => {
                            setFormData(p => ({ ...p, conjuge_id: m.id }))
                            setConjugeNome(m.nome)
                            setConjugeSearch("")
                            setShowConjugeDrop(false)
                          }}
                        >
                          {m.nome}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-muted border-t"
                      onClick={() => { setShowConjugeDrop(false); setConjugeSearch("") }}
                    >
                      Não é membro desta igreja
                    </button>
                  </div>
                )}
                {formData.conjuge_id && (
                  <p className="text-xs text-muted-foreground">Vinculado: {conjugeNome}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="rua">Rua/Avenida</Label>
                <Input id="rua" name="rua" value={formData.rua} onChange={handleChange} placeholder="Nome da rua" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero">Número</Label>
                <Input id="numero" name="numero" value={formData.numero} onChange={handleChange} placeholder="Nº" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" name="complemento" value={formData.complemento} onChange={handleChange} placeholder="Apto, Bloco..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" name="bairro" value={formData.bairro} onChange={handleChange} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" name="cidade" value={formData.cidade} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" name="estado" value={formData.estado} onChange={handleChange} placeholder="UF" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dados Eclesiásticos */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Eclesiásticos</CardTitle>
            <CardDescription>Informações sobre a vida na igreja</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo/Função</Label>
                <Input id="cargo" name="cargo" value={formData.cargo} onChange={handleChange} placeholder="Ex: Diácono, Líder de Louvor..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <select id="status" name="status" value={formData.status} onChange={handleChange} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="visitante">Visitante</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="data_entrada">Data de Entrada *</Label>
                <Input id="data_entrada" name="data_entrada" type="date" value={formData.data_entrada} onChange={handleChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_batismo">Data de Batismo</Label>
                <Input id="data_batismo" name="data_batismo" type="date" value={formData.data_batismo} onChange={handleChange} />
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <input type="checkbox" id="dizimista" name="dizimista" checked={formData.dizimista} onChange={handleChange} className="h-4 w-4 rounded border-gray-300" />
                <Label htmlFor="dizimista" className="cursor-pointer">Dizimista</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <textarea id="observacoes" name="observacoes" value={formData.observacoes} onChange={handleChange} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Observações adicionais..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/membros">
            <Button type="button" variant="outline" disabled={loading}>Cancelar</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {loading ? "Salvando..." : "Salvar Membro"}
          </Button>
        </div>
      </form>
    </>
  )
}
