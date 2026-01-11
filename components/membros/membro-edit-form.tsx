"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import type { Membro } from "@/types/database.types"

interface MembroEditFormProps {
  membro: Membro
}

interface MembroFormData {
  nome: string
  cpf: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: "masculino" | "feminino" | ""
  estado_civil: "solteiro" | "casado" | "divorciado" | "viuvo" | ""
  cargo: string
  dizimista: boolean
  data_batismo: string
  data_entrada: string
  status: "ativo" | "inativo" | "visitante"
  observacoes: string
  // Endereço
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

export function MembroEditForm({ membro }: MembroEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Inicializar form com dados do membro
  const [formData, setFormData] = useState<MembroFormData>({
    nome: membro.nome || "",
    cpf: membro.cpf || "",
    email: membro.email || "",
    telefone: membro.telefone || "",
    data_nascimento: membro.data_nascimento || "",
    sexo: (membro.sexo as any) || "",
    estado_civil: (membro.estado_civil as any) || "",
    cargo: membro.cargo || "",
    dizimista: membro.dizimista || false,
    data_batismo: membro.data_batismo || "",
    data_entrada: membro.data_entrada || "",
    status: membro.status || "ativo",
    observacoes: membro.observacoes || "",
    rua: (membro.endereco as any)?.rua || "",
    numero: (membro.endereco as any)?.numero || "",
    complemento: (membro.endereco as any)?.complemento || "",
    bairro: (membro.endereco as any)?.bairro || "",
    cidade: (membro.endereco as any)?.cidade || "",
    estado: (membro.endereco as any)?.estado || "",
    cep: (membro.endereco as any)?.cep || "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Construir objeto de endereço
      const endereco = {
        rua: formData.rua,
        numero: formData.numero,
        complemento: formData.complemento,
        bairro: formData.bairro,
        cidade: formData.cidade,
        estado: formData.estado,
        cep: formData.cep,
      }

      // Preparar dados para envio
      const payload = {
        nome: formData.nome,
        cpf: formData.cpf || null,
        email: formData.email || null,
        telefone: formData.telefone || null,
        data_nascimento: formData.data_nascimento || null,
        sexo: formData.sexo || null,
        endereco: endereco.rua ? endereco : null,
        estado_civil: formData.estado_civil || null,
        cargo: formData.cargo || null,
        dizimista: formData.dizimista,
        data_batismo: formData.data_batismo || null,
        data_entrada: formData.data_entrada,
        status: formData.status,
        observacoes: formData.observacoes || null,
      }

      const response = await fetch(`/api/membros/${membro.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Erro ao atualizar membro")
      }

      router.push(`/membros/${membro.id}`)
      router.refresh()
    } catch (error) {
      console.error("Erro ao atualizar membro:", error)
      alert(error instanceof Error ? error.message : "Erro ao atualizar membro")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link href={`/membros/${membro.id}`}>
          <Button type="button" variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

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
              <Input
                id="nome"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                required
                placeholder="Digite o nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <Input
                id="data_nascimento"
                name="data_nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sexo">Sexo</Label>
              <select
                id="sexo"
                name="sexo"
                value={formData.sexo}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione...</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado_civil">Estado Civil</Label>
              <select
                id="estado_civil"
                name="estado_civil"
                value={formData.estado_civil}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione...</option>
                <option value="solteiro">Solteiro(a)</option>
                <option value="casado">Casado(a)</option>
                <option value="divorciado">Divorciado(a)</option>
                <option value="viuvo">Viúvo(a)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
          <CardDescription>Informações de endereço do membro</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="rua">Rua/Avenida</Label>
              <Input
                id="rua"
                name="rua"
                value={formData.rua}
                onChange={handleChange}
                placeholder="Nome da rua"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                name="numero"
                value={formData.numero}
                onChange={handleChange}
                placeholder="Nº"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                name="complemento"
                value={formData.complemento}
                onChange={handleChange}
                placeholder="Apto, Bloco, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                name="bairro"
                value={formData.bairro}
                onChange={handleChange}
                placeholder="Nome do bairro"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
                placeholder="Nome da cidade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input
                id="estado"
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                placeholder="UF"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                name="cep"
                value={formData.cep}
                onChange={handleChange}
                placeholder="00000-000"
              />
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
              <Input
                id="cargo"
                name="cargo"
                value={formData.cargo}
                onChange={handleChange}
                placeholder="Ex: Diácono, Líder de Louvor, etc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="visitante">Visitante</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="data_entrada">Data de Entrada *</Label>
              <Input
                id="data_entrada"
                name="data_entrada"
                type="date"
                value={formData.data_entrada}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_batismo">Data de Batismo</Label>
              <Input
                id="data_batismo"
                name="data_batismo"
                type="date"
                value={formData.data_batismo}
                onChange={handleChange}
              />
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <input
                type="checkbox"
                id="dizimista"
                name="dizimista"
                checked={formData.dizimista}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="dizimista" className="cursor-pointer">
                Dizimista
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <textarea
              id="observacoes"
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Observações adicionais sobre o membro..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-4">
        <Link href={`/membros/${membro.id}`}>
          <Button type="button" variant="outline" disabled={loading}>
            Cancelar
          </Button>
        </Link>
        <Button type="submit" disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </form>
  )
}
