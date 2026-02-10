'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Power, Trash2, Calendar, Target, X, Camera } from 'lucide-react';
import { Company } from '@/types/database.types';
import { usePhoneMask } from '@/lib/hooks/usePhoneMask';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function EmpresaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { applyPhoneMask, removeMask } = usePhoneMask();

  useEffect(() => {
    fetchCompany();
  }, [params.id]);

  async function fetchCompany() {
    try {
      const response = await fetch(`/api/admin/companies/${params.id}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setCompany(data.data);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar empresa');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!company) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(company),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success('Empresa atualizada com sucesso!');
      setCompany(data.data);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar empresa');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!company) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...company, is_active: !company.is_active }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success(
        `Empresa ${!company.is_active ? 'ativada' : 'desativada'} com sucesso!`
      );
      setCompany(data.data);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar status');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!company) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/companies/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success('Empresa deletada com sucesso!');
      router.push('/admin/empresas');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar empresa');
      setSaving(false);
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', company.id.toString());

      const response = await fetch('/api/company/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setCompany({ ...company, image_url: data.logoUrl });
        toast.success('Logo carregado com sucesso!');
      } else {
        toast.error(data.message || 'Erro ao fazer upload');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage() {
    if (!company) return;
    setCompany({ ...company, image_url: '' });
  }

  if (loading || !company) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <p className="text-muted-foreground mt-1">Detalhes e configurações</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={company.is_active ? 'outline' : 'default'}
            onClick={handleToggleStatus}
            disabled={saving}
          >
            <Power className="mr-2 h-4 w-4" />
            {company.is_active ? 'Desativar' : 'Ativar'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" />
                Deletar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Isso irá deletar permanentemente a
                  empresa <strong>{company.name}</strong> e todos os seus dados
                  associados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Deletar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={company.name}
                onChange={(e) => setCompany({ ...company, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={company.email}
                onChange={(e) => setCompany({ ...company, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={applyPhoneMask(company.phone || '')}
                onChange={(e) => {
                  const masked = applyPhoneMask(e.target.value);
                  const unmasked = removeMask(e.target.value);
                  setCompany({ ...company, phone: unmasked });
                }}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
              <p className="text-xs text-muted-foreground">
                Detecta automaticamente fixo ou móvel
              </p>
            </div>

            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="flex items-center gap-4">
                {company.image_url ? (
                  <div className="relative">
                    <img
                      src={company.image_url}
                      alt="Logo da empresa"
                      className="w-20 h-20 rounded-full object-cover border-2 border-border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        {company.image_url ? 'Alterar Logo' : 'Fazer Upload'}
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WEBP ou GIF (máx. 2MB)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                {company.is_active ? (
                  <Badge className="bg-primary">Ativa</Badge>
                ) : (
                  <Badge variant="destructive">Inativa</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Planos e Limites</CardTitle>
                <CardDescription>Configure o plano e acompanhe MQLs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan_type">Plano</Label>
              <Select
                value={company.plan_type || 'basic'}
                onValueChange={(value: any) => {
                  const planNameMap: Record<string, string> = {
                    'basic': 'NEXIO SALES',
                    'performance': 'NEXIO GROWTH',
                    'advanced': 'NEXIO ADS'
                  };
                  const planPriceMap: Record<string, number> = {
                    'basic': 1600,
                    'performance': 2000,
                    'advanced': 2600
                  };
                  setCompany({
                    ...company,
                    plan_type: value,
                    plan_name: planNameMap[value] as any,
                    plan_price: planPriceMap[value]
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    <div className="flex flex-col">
                      <span className="font-medium">NEXIO SALES</span>
                      <span className="text-xs text-muted-foreground">R$ 1.600/mês (sem extração)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="performance">
                    <div className="flex flex-col">
                      <span className="font-medium">NEXIO GROWTH</span>
                      <span className="text-xs text-muted-foreground">R$ 2.000/mês (500 leads inclusos)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="advanced">
                    <div className="flex flex-col">
                      <span className="font-medium">NEXIO ADS</span>
                      <span className="text-xs text-muted-foreground">R$ 2.600/mês (Sales + Tráfego Pago)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground space-y-1 mt-2">
                {company.plan_type === 'basic' && <p>CRM Completo + Chat IA + Funil de Vendas</p>}
                {company.plan_type === 'performance' && (
                  <>
                    <p>500 leads inclusos/mês</p>
                    <p>Leads extras: R$ 1/lead ou R$ 400 por pacote de +500</p>
                  </>
                )}
                {company.plan_type === 'advanced' && <p>Sales + Gestão de Tráfego Pago integrado</p>}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subscription_expires_at">Data de Vencimento</Label>
              <div className="flex gap-2">
                <Input
                  id="subscription_expires_at"
                  type="date"
                  value={
                    company.subscription_expires_at
                      ? new Date(company.subscription_expires_at).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    setCompany({ ...company, subscription_expires_at: e.target.value })
                  }
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    setCompany({
                      ...company,
                      subscription_expires_at: nextMonth.toISOString(),
                    });
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  +30d
                </Button>
              </div>
              {company.subscription_expires_at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(company.subscription_expires_at) < new Date() ? (
                    <span className="text-red-500 font-semibold">
                      ⚠️ Vencida há{' '}
                      {Math.floor(
                        (new Date().getTime() -
                          new Date(company.subscription_expires_at).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      dias
                    </span>
                  ) : (
                    <span className="text-primary">
                      ✓ Vence em{' '}
                      {Math.floor(
                        (new Date(company.subscription_expires_at).getTime() -
                          new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )}{' '}
                      dias
                    </span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>WhatsApp (UAZap)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="whatsapp_instance">Nome da Instância</Label>
                <Input
                  id="whatsapp_instance"
                  value={company.whatsapp_instance || ''}
                  onChange={(e) =>
                    setCompany({ ...company, whatsapp_instance: e.target.value })
                  }
                  placeholder="Ex: minha-empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_token">Token</Label>
                <Input
                  id="whatsapp_token"
                  type="password"
                  value={company.whatsapp_token || ''}
                  onChange={(e) => setCompany({ ...company, whatsapp_token: e.target.value })}
                  placeholder="Token de acesso"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Alterações'
          )}
        </Button>
      </div>
    </div>
  );
}
