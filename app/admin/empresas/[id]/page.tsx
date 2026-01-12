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
import { ArrowLeft, Loader2, Settings, Power, Trash2, Calendar, Target, Info, Upload, X, Camera } from 'lucide-react';
import { Company } from '@/types/database.types';
import Link from 'next/link';
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
import { createClient } from '@/lib/supabase/client';

interface Plan {
  id: number;
  name: string;
  extraction_limit: number;
  mql_percentage: number;
  description: string;
}

export default function EmpresaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { applyPhoneMask, removeMask } = usePhoneMask();

  useEffect(() => {
    fetchCompany();
    fetchPlans();
  }, [params.id]);

  useEffect(() => {
    if (company?.plan_id && plans.length > 0) {
      const plan = plans.find(p => p.id === company.plan_id);
      setSelectedPlan(plan || null);
    }
  }, [company?.plan_id, plans]);

  async function fetchPlans() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('id');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  }

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
          {company.vendagro_plan && (
            <Link href={`/admin/empresas/${params.id}/icp`}>
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Configurar ICP
              </Button>
            </Link>
          )}
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
                value={company.plan_type || 'crm-smart'}
                onValueChange={(value: any) => setCompany({ ...company, plan_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crm-smart">CRM Smart</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan_id">Plano VendAgro</Label>
              <Select
                value={company.plan_id?.toString() || 'none'}
                onValueChange={(value: any) => {
                  const planId = value === 'none' ? null : parseInt(value);
                  setCompany({ ...company, plan_id: planId });
                  const plan = plans.find(p => p.id === planId);
                  setSelectedPlan(plan || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem VendAgro</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPlan && (
              <>
                {/* Distribuição de Leads e MQLs */}
                <div className="border-2 border-primary/20 rounded-lg p-4 space-y-3 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Distribuição Mensal</p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold text-primary">
                        {selectedPlan.extraction_limit}
                      </p>
                      <p className="text-xs">leads/mês</p>
                    </div>
                    <div className="text-center border-l pl-3">
                      <p className="text-xs text-muted-foreground">MQLs ({selectedPlan.mql_percentage}%)</p>
                      <p className="text-2xl font-bold text-green-600">
                        {Math.floor((selectedPlan.extraction_limit * selectedPlan.mql_percentage) / 100)}
                      </p>
                      <p className="text-xs">qualificados</p>
                    </div>
                    <div className="text-center border-l pl-3">
                      <p className="text-xs text-muted-foreground">Normais</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedPlan.extraction_limit - Math.floor((selectedPlan.extraction_limit * selectedPlan.mql_percentage) / 100)}
                      </p>
                      <p className="text-xs">leads</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">{selectedPlan.description}</p>
                  </div>
                </div>

                {/* Uso Atual */}
                <div className="border rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">Uso Este Mês</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold">{company.leads_extracted_this_month || 0}</p>
                    <p className="text-muted-foreground">/ {selectedPlan.extraction_limit} extraídos</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{
                        width: `${Math.min(100, ((company.leads_extracted_this_month || 0) / selectedPlan.extraction_limit) * 100)}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Restam <strong>{selectedPlan.extraction_limit - (company.leads_extracted_this_month || 0)}</strong> leads
                  </p>
                </div>

                {/* Explicação MQL */}
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">
                        O que são MQLs?
                      </p>
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>MQL (Marketing Qualified Lead)</strong> são leads qualificados pelo marketing
                        que atendem ao ICP e têm maior chance de conversão. São pré-qualificados e prontos
                        para abordagem comercial.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
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
                    <span className="text-green-500">
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
