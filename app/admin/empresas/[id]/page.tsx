'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Settings, Power, Trash2, Calendar } from 'lucide-react';
import { Company } from '@/types/database.types';
import Link from 'next/link';
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
                value={company.phone || ''}
                onChange={(e) => setCompany({ ...company, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                {company.is_active ? (
                  <Badge className="bg-green-500">Ativa</Badge>
                ) : (
                  <Badge variant="destructive">Inativa</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planos e Limites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan_type">Plano</Label>
              <Select
                value={company.plan_type}
                onValueChange={(value: any) => setCompany({ ...company, plan_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendagro_plan">Plano VendAgro</Label>
              <Select
                value={company.vendagro_plan || 'none'}
                onValueChange={(value: any) =>
                  setCompany({ ...company, vendagro_plan: value === 'none' ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem VendAgro</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {company.vendagro_plan && (
              <div className="border rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium">Limite Mensal</p>
                <p className="text-2xl font-bold">{company.plan_monthly_limit} leads</p>
                <p className="text-xs text-muted-foreground">
                  Extraídos este mês: {company.leads_extracted_this_month || 0}
                </p>
              </div>
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
