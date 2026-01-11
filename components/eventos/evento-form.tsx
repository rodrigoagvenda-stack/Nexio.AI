"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

interface EventoFormData {
  nome: string
  tipo: string
  descricao: string
  local: string
  data_inicio: string
  data_fim: string
  hora_inicio: string
  hora_fim: string
  valor_inscricao: string
  capacidade: string
  inscricoes_abertas: boolean
}

export function EventoForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<EventoFormData>({
    nome: "",
    tipo: "",
    descricao: "",
    local: "",
    data_inicio: "",
    data_fim: "",
    hora_inicio: "",
    hora_fim: "",
    valor_inscricao: "0",
    capacidade: "",
    inscricoes_abertas: true,
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
      const payload = {
        nome: formData.nome,
        tipo: formData.tipo || null,
        descricao: formData.descricao || null,
        local: formData.local || null,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim || null,
        hora_inicio: formData.hora_inicio || null,
        hora_fim: formData.hora_fim || null,
        valor_inscricao: parseFloat(formData.valor_inscricao) || 0,
        capacidade: formData.capacidade ? parseInt(formData.capacidade) : null,
        inscricoes_abertas: formData.inscricoes_abertas,
      }

      const response = await fetch("/api/eventos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erro ao criar evento")
      }

      router.push("/eventos")
      router.refresh()
    } catch (error) {
      console.error("Erro ao criar evento:", error)
      alert(error instanceof Error ? error.message : "Erro ao criar evento")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link href="/eventos">
          <Button type="button" variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </Link>
      </div>

      {/* Informações Básicas */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>Dados principais do evento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Evento *</Label>
            <Input
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              required
              placeholder="Ex: Culto de Ação de Graças"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Evento</Label>
              <select
                id="tipo"
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Selecione...</option>
                <option value="culto">Culto</option>
                <option value="conferencia">Conferência</option>
                <option value="retiro">Retiro</option>
                <option value="estudo">Estudo Bíblico</option>
                <option value="vigilia">Vigília</option>
                <option value="evangelismo">Evangelismo</option>
                <option value="social">Evento Social</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="local">Local</Label>
              <Input
                id="local"
                name="local"
                value={formData.local}
                onChange={handleChange}
                placeholder="Ex: Templo Central"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <textarea
              id="descricao"
              name="descricao"
              value={formData.descricao}
              onChange={handleChange}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Descreva os detalhes do evento..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Data e Horário */}
      <Card>
        <CardHeader>
          <CardTitle>Data e Horário</CardTitle>
          <CardDescription>Quando o evento acontecerá</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data de Início *</Label>
              <Input
                id="data_inicio"
                name="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_fim">Data de Término</Label>
              <Input
                id="data_fim"
                name="data_fim"
                type="date"
                value={formData.data_fim}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hora_inicio">Hora de Início</Label>
              <Input
                id="hora_inicio"
                name="hora_inicio"
                type="time"
                value={formData.hora_inicio}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora_fim">Hora de Término</Label>
              <Input
                id="hora_fim"
                name="hora_fim"
                type="time"
                value={formData.hora_fim}
                onChange={handleChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inscrições */}
      <Card>
        <CardHeader>
          <CardTitle>Inscrições</CardTitle>
          <CardDescription>Configurações de inscrição para o evento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="valor_inscricao">Valor da Inscrição (R$)</Label>
              <Input
                id="valor_inscricao"
                name="valor_inscricao"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_inscricao}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacidade">Capacidade (Vagas)</Label>
              <Input
                id="capacidade"
                name="capacidade"
                type="number"
                min="1"
                value={formData.capacidade}
                onChange={handleChange}
                placeholder="Deixe em branco para ilimitado"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="inscricoes_abertas"
              name="inscricoes_abertas"
              checked={formData.inscricoes_abertas}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="inscricoes_abertas" className="cursor-pointer">
              Inscrições abertas
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Botões de Ação */}
      <div className="flex justify-end gap-4">
        <Link href="/eventos">
          <Button type="button" variant="outline" disabled={loading}>
            Cancelar
          </Button>
        </Link>
        <Button type="submit" disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          {loading ? "Salvando..." : "Criar Evento"}
        </Button>
      </div>
    </form>
  )
}
