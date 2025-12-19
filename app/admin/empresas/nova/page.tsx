'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NovaEmpresaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    plan_type: 'basic' as 'basic' | 'performance' | 'advanced',
    vendagro_plan: null as 'performance' | 'advanced' | null,
    plan_monthly_limit: 0,
    whatsapp_instance: '',
    whatsapp_token: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Calcular limite mensal baseado no plano VendAgro
      const limit = formData.vendagro_plan === 'performance' ? 70 : formData.vendagro_plan === 'advanced' ? 115 : 0;

      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          plan_monthly_limit: limit,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success('Empresa criada com sucesso!');
      router.push('/admin/empresas');
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast.error(error.message || 'Erro ao criar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nova Empresa</h1>
          <p className="text-muted-foreground mt-1">Cadastre uma nova empresa no sistema</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Empresa X Ltda"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contato@empresa.com"
              />
              <p className="text-xs text-muted-foreground">
                Será usado como login do usuário
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(14) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan_type">Plano *</Label>
              <Select
                value={formData.plan_type}
                onValueChange={(value: any) => setFormData({ ...formData, plan_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Basic (R$ 197/mês)</SelectItem>
                  <SelectItem value="performance">Performance (R$ 497/mês)</SelectItem>
                  <SelectItem value="advanced">Advanced (R$ 997/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendagro_plan">Plano VendAgro (opcional)</Label>
              <Select
                value={formData.vendagro_plan || 'none'}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, vendagro_plan: value === 'none' ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem VendAgro</SelectItem>
                  <SelectItem value="performance">Performance (70 leads/mês)</SelectItem>
                  <SelectItem value="advanced">Advanced (115 leads/mês)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Habilita módulo Lead PRO com extração de leads ICP
              </p>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold">WhatsApp (UAZap)</h3>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_instance">Nome da Instância</Label>
                <Input
                  id="whatsapp_instance"
                  value={formData.whatsapp_instance}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp_instance: e.target.value })
                  }
                  placeholder="vendai-instance"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_token">Token da Instância</Label>
                <Input
                  id="whatsapp_token"
                  value={formData.whatsapp_token}
                  onChange={(e) =>
                    setFormData({ ...formData, whatsapp_token: e.target.value })
                  }
                  placeholder="abc123xyz"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Empresa'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
