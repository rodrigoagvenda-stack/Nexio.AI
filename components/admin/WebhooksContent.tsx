'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface Webhook {
  id: string
  name: string
  type: string
  url: string
  secret: string
  is_active: boolean
  created_at?: string
}

interface AIConfig {
  id?: number
  provider: string
  model: string
  api_key: string
}

interface UazapiConfig {
  id?: number
  api_token: string
  instance: string
  phone: string
}

interface N8NWebhookConfig {
  id?: number
  webhook_type: string
  webhook_url: string
  auth_type: string
  auth_username?: string
  auth_password?: string
  auth_token?: string
  is_active: boolean
}

interface WebhooksContentProps {
  webhooks: Webhook[]
  aiConfig: AIConfig | null
  uazapiConfig: UazapiConfig | null
  n8nWebhooks?: N8NWebhookConfig[]
}

export function WebhooksContent({ webhooks: initialWebhooks, aiConfig: initialAIConfig, uazapiConfig: initialUazapiConfig, n8nWebhooks: initialN8NWebhooks }: WebhooksContentProps) {
  const router = useRouter()
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks)
  const [aiConfig, setAIConfig] = useState<AIConfig>(initialAIConfig || {
    provider: 'openai',
    model: 'gpt-4',
    api_key: '',
  })
  const [uazapiConfig, setUazapiConfig] = useState<UazapiConfig>(initialUazapiConfig || {
    api_token: '',
    instance: '',
    phone: '',
  })

  // N8N Webhooks (Orbit)
  const [n8nMaps, setN8nMaps] = useState<N8NWebhookConfig>(() => {
    const existing = initialN8NWebhooks?.find(w => w.webhook_type === 'maps')
    return existing || { webhook_type: 'maps', webhook_url: '', auth_type: 'basic', auth_username: '', auth_password: '', is_active: true }
  })
  const [n8nIcp, setN8nIcp] = useState<N8NWebhookConfig>(() => {
    const existing = initialN8NWebhooks?.find(w => w.webhook_type === 'icp')
    return existing || { webhook_type: 'icp', webhook_url: '', auth_type: 'basic', auth_username: '', auth_password: '', is_active: true }
  })
  const [n8nWhatsapp, setN8nWhatsapp] = useState<N8NWebhookConfig>(() => {
    const existing = initialN8NWebhooks?.find(w => w.webhook_type === 'whatsapp')
    return existing || { webhook_type: 'whatsapp', webhook_url: '', auth_type: 'basic', auth_username: '', auth_password: '', is_active: true }
  })

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [formData, setFormData] = useState<Partial<Webhook>>({
    name: '',
    type: '',
    url: '',
    secret: '',
  })

  const [showAIKey, setShowAIKey] = useState(false)
  const [showUazapiToken, setShowUazapiToken] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const supabase = createClient()

  const handleSaveN8NWebhook = async (config: N8NWebhookConfig) => {
    setLoading(true)
    try {
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('n8n_webhook_config')
        .select('id')
        .eq('webhook_type', config.webhook_type)
        .single()

      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from('n8n_webhook_config')
          .update({
            webhook_url: config.webhook_url,
            auth_type: config.auth_type,
            auth_username: config.auth_username,
            auth_password: config.auth_password,
            auth_token: config.auth_token,
            is_active: config.is_active,
          })
          .eq('webhook_type', config.webhook_type)

        if (error) throw error
      } else {
        // Inserir
        const { error } = await supabase
          .from('n8n_webhook_config')
          .insert([config])

        if (error) throw error
      }

      toast.success(`Webhook ${config.webhook_type} salvo com sucesso`)
      router.refresh()
    } catch (error) {
      console.error('Error saving N8N webhook:', error)
      toast.error('Erro ao salvar webhook N8N')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveAIConfig = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('ai_config')
        .upsert({
          id: aiConfig.id || 1,
          provider: aiConfig.provider,
          model: aiConfig.model,
          api_key: aiConfig.api_key,
        })

      if (error) throw error
      toast.success('Configuração de IA salva com sucesso')
      router.refresh()
    } catch (error) {
      console.error('Error saving AI config:', error)
      toast.error('Erro ao salvar configuração de IA')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveUazapiConfig = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('uazapi_config')
        .upsert({
          id: uazapiConfig.id || 1,
          api_token: uazapiConfig.api_token,
          instance: uazapiConfig.instance,
          phone: uazapiConfig.phone,
        })

      if (error) throw error
      toast.success('Configuração Uazapi salva com sucesso')
      router.refresh()
    } catch (error) {
      console.error('Error saving Uazapi config:', error)
      toast.error('Erro ao salvar configuração Uazapi')
    } finally {
      setLoading(false)
    }
  }

  const handleAddWebhook = () => {
    setEditingWebhook(null)
    setFormData({ name: '', type: '', url: '', secret: '', is_active: true })
    setIsDialogOpen(true)
  }

  const handleEditWebhook = (webhook: Webhook) => {
    setEditingWebhook(webhook)
    setFormData(webhook)
    setIsDialogOpen(true)
  }

  const handleDeleteWebhook = async (id: string) => {
    try {
      const { error } = await supabase.from('webhook_configs').delete().eq('id', id)

      if (error) throw error
      toast.success('Webhook removido com sucesso')
      router.refresh()
    } catch (error) {
      console.error('Error deleting webhook:', error)
      toast.error('Erro ao remover webhook')
    }
  }

  const handleSaveWebhook = async () => {
    setLoading(true)
    try {
      if (editingWebhook) {
        const { error } = await supabase
          .from('webhook_configs')
          .update({
            name: formData.name,
            type: formData.type,
            url: formData.url,
            secret: formData.secret,
          })
          .eq('id', editingWebhook.id)

        if (error) throw error
        toast.success('Webhook atualizado com sucesso')
      } else {
        const { error } = await supabase
          .from('webhook_configs')
          .insert([
            {
              name: formData.name,
              type: formData.type,
              url: formData.url,
              secret: formData.secret,
              is_active: true,
            },
          ])

        if (error) throw error
        toast.success('Webhook criado com sucesso')
      }
      setIsDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error saving webhook:', error)
      toast.error('Erro ao salvar webhook')
    } finally {
      setLoading(false)
    }
  }

  // Calcular paginação
  const totalPages = Math.ceil(webhooks.length / itemsPerPage)
  const paginatedWebhooks = webhooks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Webhooks & APIs</h1>
        <p className="text-muted-foreground">
          Gerencie webhooks, configurações de IA e integrações
        </p>
      </div>

      {/* AI Configuration Section */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
        <h2 className="mb-4 text-xl font-semibold">🤖 Configuração de IA</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">Provedor</Label>
            <Select
              value={aiConfig.provider}
              onValueChange={(value) =>
                setAIConfig({ ...aiConfig, provider: value })
              }
            >
              <SelectTrigger id="ai-provider">
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-model">Modelo</Label>
            <Input
              id="ai-model"
              value={aiConfig.model}
              onChange={(e) =>
                setAIConfig({ ...aiConfig, model: e.target.value })
              }
              placeholder="gpt-4, claude-3-opus, etc."
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ai-key">API Key</Label>
            <div className="relative">
              <Input
                id="ai-key"
                type={showAIKey ? 'text' : 'password'}
                value={aiConfig.api_key}
                onChange={(e) =>
                  setAIConfig({ ...aiConfig, api_key: e.target.value })
                }
                placeholder="sk-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowAIKey(!showAIKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showAIKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveAIConfig} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Salvar Configuração
          </Button>
        </div>
      </div>

      {/* N8N Webhooks (Orbit) Section */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
        <h2 className="mb-4 text-xl font-semibold">🚀 Webhooks N8N (Orbit)</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Configure os webhooks do N8N para extração de leads (Maps), ICP e envio de WhatsApp.
        </p>

        {/* Maps Webhook */}
        <div className="mb-6 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            🗺️ Webhook Maps (Extração de Leads)
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>URL do Webhook</Label>
              <Input
                value={n8nMaps.webhook_url}
                onChange={(e) => setN8nMaps({ ...n8nMaps, webhook_url: e.target.value })}
                placeholder="https://seu-n8n.com/webhook/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Autenticação</Label>
              <Select
                value={n8nMaps.auth_type}
                onValueChange={(value) => setN8nMaps({ ...n8nMaps, auth_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="none">Sem autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {n8nMaps.auth_type === 'basic' && (
              <>
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    value={n8nMaps.auth_username || ''}
                    onChange={(e) => setN8nMaps({ ...n8nMaps, auth_username: e.target.value })}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={n8nMaps.auth_password || ''}
                    onChange={(e) => setN8nMaps({ ...n8nMaps, auth_password: e.target.value })}
                    placeholder="Password"
                  />
                </div>
              </>
            )}
            {n8nMaps.auth_type === 'bearer' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Token</Label>
                <Input
                  type="password"
                  value={n8nMaps.auth_token || ''}
                  onChange={(e) => setN8nMaps({ ...n8nMaps, auth_token: e.target.value })}
                  placeholder="Bearer token"
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => handleSaveN8NWebhook(n8nMaps)} disabled={loading} size="sm">
              <Save className="mr-2 h-4 w-4" />
              Salvar Maps
            </Button>
          </div>
        </div>

        {/* ICP Webhook */}
        <div className="mb-6 p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            🎯 Webhook ICP (Perfil de Cliente Ideal)
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>URL do Webhook</Label>
              <Input
                value={n8nIcp.webhook_url}
                onChange={(e) => setN8nIcp({ ...n8nIcp, webhook_url: e.target.value })}
                placeholder="https://seu-n8n.com/webhook/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Autenticação</Label>
              <Select
                value={n8nIcp.auth_type}
                onValueChange={(value) => setN8nIcp({ ...n8nIcp, auth_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="none">Sem autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {n8nIcp.auth_type === 'basic' && (
              <>
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    value={n8nIcp.auth_username || ''}
                    onChange={(e) => setN8nIcp({ ...n8nIcp, auth_username: e.target.value })}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={n8nIcp.auth_password || ''}
                    onChange={(e) => setN8nIcp({ ...n8nIcp, auth_password: e.target.value })}
                    placeholder="Password"
                  />
                </div>
              </>
            )}
            {n8nIcp.auth_type === 'bearer' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Token</Label>
                <Input
                  type="password"
                  value={n8nIcp.auth_token || ''}
                  onChange={(e) => setN8nIcp({ ...n8nIcp, auth_token: e.target.value })}
                  placeholder="Bearer token"
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => handleSaveN8NWebhook(n8nIcp)} disabled={loading} size="sm">
              <Save className="mr-2 h-4 w-4" />
              Salvar ICP
            </Button>
          </div>
        </div>

        {/* WhatsApp Webhook */}
        <div className="p-4 rounded-lg border border-white/[0.08] bg-white/[0.02]">
          <h3 className="font-medium mb-3 flex items-center gap-2">
            💬 Webhook WhatsApp (Envio de Mensagens)
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>URL do Webhook</Label>
              <Input
                value={n8nWhatsapp.webhook_url}
                onChange={(e) => setN8nWhatsapp({ ...n8nWhatsapp, webhook_url: e.target.value })}
                placeholder="https://seu-n8n.com/webhook/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Autenticação</Label>
              <Select
                value={n8nWhatsapp.auth_type}
                onValueChange={(value) => setN8nWhatsapp({ ...n8nWhatsapp, auth_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="none">Sem autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {n8nWhatsapp.auth_type === 'basic' && (
              <>
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Input
                    value={n8nWhatsapp.auth_username || ''}
                    onChange={(e) => setN8nWhatsapp({ ...n8nWhatsapp, auth_username: e.target.value })}
                    placeholder="Username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={n8nWhatsapp.auth_password || ''}
                    onChange={(e) => setN8nWhatsapp({ ...n8nWhatsapp, auth_password: e.target.value })}
                    placeholder="Password"
                  />
                </div>
              </>
            )}
            {n8nWhatsapp.auth_type === 'bearer' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Token</Label>
                <Input
                  type="password"
                  value={n8nWhatsapp.auth_token || ''}
                  onChange={(e) => setN8nWhatsapp({ ...n8nWhatsapp, auth_token: e.target.value })}
                  placeholder="Bearer token"
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => handleSaveN8NWebhook(n8nWhatsapp)} disabled={loading} size="sm">
              <Save className="mr-2 h-4 w-4" />
              Salvar WhatsApp
            </Button>
          </div>
        </div>
      </div>

      {/* Uazapi Configuration Section */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
        <h2 className="mb-4 text-xl font-semibold">📱 Configuração Uazapi</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="uazapi-instance">Instância</Label>
            <Input
              id="uazapi-instance"
              value={uazapiConfig.instance}
              onChange={(e) =>
                setUazapiConfig({ ...uazapiConfig, instance: e.target.value })
              }
              placeholder="Nome da instância"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="uazapi-phone">Telefone</Label>
            <Input
              id="uazapi-phone"
              value={uazapiConfig.phone}
              onChange={(e) =>
                setUazapiConfig({ ...uazapiConfig, phone: e.target.value })
              }
              placeholder="+5511999999999"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="uazapi-token">API Token</Label>
            <div className="relative">
              <Input
                id="uazapi-token"
                type={showUazapiToken ? 'text' : 'password'}
                value={uazapiConfig.api_token}
                onChange={(e) =>
                  setUazapiConfig({
                    ...uazapiConfig,
                    api_token: e.target.value,
                  })
                }
                placeholder="Token da API Uazapi"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowUazapiToken(!showUazapiToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showUazapiToken ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSaveUazapiConfig} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Salvar Configuração
          </Button>
        </div>
      </div>

      {/* Webhooks Section */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">⚙️ Webhooks Genéricos</h2>
          <Button onClick={handleAddWebhook}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Webhook
          </Button>
        </div>

        <div className="rounded-lg border border-white/[0.08]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWebhooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum webhook cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedWebhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell>{webhook.type}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${webhook.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${webhook.is_active ? 'bg-green-500' : 'bg-gray-500'}`} />
                        {webhook.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditWebhook(webhook)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {webhooks.length > 0 && totalPages > 1 && (
            <div className="p-4 border-t border-white/[0.08]">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <PaginationEllipsis key={page} />;
                    }
                    return null;
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>

      {/* Webhook Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Editar Webhook' : 'Adicionar Webhook'}
            </DialogTitle>
            <DialogDescription>
              {editingWebhook
                ? 'Atualize as informações do webhook.'
                : 'Preencha as informações do novo webhook.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Nome</Label>
              <Input
                id="webhook-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Nome do webhook"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-type">Tipo</Label>
              <Input
                id="webhook-type"
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value })
                }
                placeholder="payment, notification, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                value={formData.url}
                onChange={(e) =>
                  setFormData({ ...formData, url: e.target.value })
                }
                placeholder="https://exemplo.com/webhook"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Secret</Label>
              <Input
                id="webhook-secret"
                type="password"
                value={formData.secret}
                onChange={(e) =>
                  setFormData({ ...formData, secret: e.target.value })
                }
                placeholder="Secret para validação"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={loading}
            >
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSaveWebhook} disabled={loading}>
              <Save className="mr-2 h-4 w-4" />
              {editingWebhook ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
