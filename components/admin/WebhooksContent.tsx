'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { toast } from '@/components/ui/use-toast';
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

      toast({ title: `Webhook ${config.webhook_type} salvo com sucesso` })
      router.refresh()
    } catch (error) {
      console.error('Error saving N8N webhook:', error)
      toast({ title: 'Erro ao salvar webhook N8N', variant: 'destructive' })
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
      toast({ title: 'Configuração de IA salva com sucesso' })
      router.refresh()
    } catch (error) {
      console.error('Error saving AI config:', error)
      toast({ title: 'Erro ao salvar configuração de IA', variant: 'destructive' })
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
      toast({ title: 'Configuração Uazapi salva com sucesso' })
      router.refresh()
    } catch (error) {
      console.error('Error saving Uazapi config:', error)
      toast({ title: 'Erro ao salvar configuração Uazapi', variant: 'destructive' })
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
      toast({ title: 'Webhook removido com sucesso' })
      router.refresh()
    } catch (error) {
      console.error('Error deleting webhook:', error)
      toast({ title: 'Erro ao remover webhook', variant: 'destructive' })
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
        toast({ title: 'Webhook atualizado com sucesso' })
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
        toast({ title: 'Webhook criado com sucesso' })
      }
      setIsDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error saving webhook:', error)
      toast({ title: 'Erro ao salvar webhook', variant: 'destructive' })
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

  // Componente interno para renderizar webhook N8N
  const N8NWebhookCard = ({ title, description, config, setConfig, onSave }: {
    title: string
    description: string
    config: N8NWebhookConfig
    setConfig: (c: N8NWebhookConfig) => void
    onSave: () => void
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
          <Badge variant={config.is_active ? 'default' : 'secondary'}>
            {config.is_active ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">URL</Label>
          <Input
            value={config.webhook_url}
            onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
            placeholder="https://seu-n8n.com/webhook/..."
            className="h-9 text-sm"
          />
        </div>
        <div className="grid gap-3 grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Autenticação</Label>
            <Select
              value={config.auth_type}
              onValueChange={(value) => setConfig({ ...config, auth_type: value })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.auth_type === 'basic' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Usuário</Label>
                <Input
                  value={config.auth_username || ''}
                  onChange={(e) => setConfig({ ...config, auth_username: e.target.value })}
                  placeholder="Username"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Senha</Label>
                <Input
                  type="password"
                  value={config.auth_password || ''}
                  onChange={(e) => setConfig({ ...config, auth_password: e.target.value })}
                  placeholder="Password"
                  className="h-9 text-sm"
                />
              </div>
            </>
          )}
          {config.auth_type === 'bearer' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Token</Label>
              <Input
                type="password"
                value={config.auth_token || ''}
                onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
                placeholder="Bearer token"
                className="h-9 text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex justify-end pt-1">
          <Button onClick={onSave} disabled={loading} size="sm">
            <Save className="mr-2 h-3.5 w-3.5" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground mt-1">
          Configure webhooks, IA e integrações do sistema
        </p>
      </div>

      {/* Grid de configurações principais */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Configuração de IA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Configuração de IA</CardTitle>
            <CardDescription className="text-xs">Provedor e modelo para análise automática</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Provedor</Label>
                <Select
                  value={aiConfig.provider}
                  onValueChange={(value) => setAIConfig({ ...aiConfig, provider: value })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo</Label>
                <Input
                  value={aiConfig.model}
                  onChange={(e) => setAIConfig({ ...aiConfig, model: e.target.value })}
                  placeholder="gpt-4"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <div className="relative">
                <Input
                  type={showAIKey ? 'text' : 'password'}
                  value={aiConfig.api_key}
                  onChange={(e) => setAIConfig({ ...aiConfig, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="h-9 text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowAIKey(!showAIKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAIKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={handleSaveAIConfig} disabled={loading} size="sm">
                <Save className="mr-2 h-3.5 w-3.5" />
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Configuração Uazapi */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Uazapi (WhatsApp)</CardTitle>
            <CardDescription className="text-xs">Configuração da API de mensagens</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Instância</Label>
                <Input
                  value={uazapiConfig.instance}
                  onChange={(e) => setUazapiConfig({ ...uazapiConfig, instance: e.target.value })}
                  placeholder="Nome da instância"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={uazapiConfig.phone}
                  onChange={(e) => setUazapiConfig({ ...uazapiConfig, phone: e.target.value })}
                  placeholder="+5511999999999"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API Token</Label>
              <div className="relative">
                <Input
                  type={showUazapiToken ? 'text' : 'password'}
                  value={uazapiConfig.api_token}
                  onChange={(e) => setUazapiConfig({ ...uazapiConfig, api_token: e.target.value })}
                  placeholder="Token da API"
                  className="h-9 text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowUazapiToken(!showUazapiToken)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showUazapiToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={handleSaveUazapiConfig} disabled={loading} size="sm">
                <Save className="mr-2 h-3.5 w-3.5" />
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhooks N8N */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Webhooks N8N</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <N8NWebhookCard
            title="Maps"
            description="Extração de leads"
            config={n8nMaps}
            setConfig={setN8nMaps}
            onSave={() => handleSaveN8NWebhook(n8nMaps)}
          />
          <N8NWebhookCard
            title="ICP"
            description="Perfil de cliente ideal"
            config={n8nIcp}
            setConfig={setN8nIcp}
            onSave={() => handleSaveN8NWebhook(n8nIcp)}
          />
          <N8NWebhookCard
            title="WhatsApp"
            description="Envio de mensagens"
            config={n8nWhatsapp}
            setConfig={setN8nWhatsapp}
            onSave={() => handleSaveN8NWebhook(n8nWhatsapp)}
          />
        </div>
      </div>

      {/* Webhooks Genéricos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Webhooks Genéricos</h2>
          <Button onClick={handleAddWebhook} size="sm">
            <Plus className="mr-2 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        <Card>
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
                    <TableCell className="text-muted-foreground">{webhook.type}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                      {webhook.url}
                    </TableCell>
                    <TableCell>
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                        {webhook.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditWebhook(webhook)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteWebhook(webhook.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {webhooks.length > 0 && totalPages > 1 && (
            <div className="p-4 border-t">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <PaginationEllipsis key={page} />
                    }
                    return null
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
        </Card>
      </div>

      {/* Dialog Webhook */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
            <DialogDescription>
              {editingWebhook ? 'Atualize as informações do webhook.' : 'Preencha os dados do novo webhook.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome do webhook" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} placeholder="payment, notification, etc." />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://exemplo.com/webhook" />
            </div>
            <div className="space-y-2">
              <Label>Secret</Label>
              <Input type="password" value={formData.secret} onChange={(e) => setFormData({ ...formData, secret: e.target.value })} placeholder="Secret para validação" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={loading}>Cancelar</Button>
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
