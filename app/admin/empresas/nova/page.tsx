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
import { ArrowLeft, Loader2, Building2, TrendingUp, Zap, Check } from 'lucide-react';

export default function NovaEmpresaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    plan_type: 'basic' as 'basic' | 'performance' | 'advanced',
    whatsapp_instance: '',
    whatsapp_token: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
          <div className="p-6 border-b border-white/[0.08]">
            <h2 className="text-xl font-semibold">Informações da Empresa</h2>
          </div>
          <div className="p-6 space-y-4">
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

            <div className="space-y-3">
              <Label htmlFor="plan_type">Plano *</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { value: 'basic', name: 'NEXIO SALES', price: 'R$ 1.600', icon: Building2, color: 'from-blue-500/20 to-blue-600/20', features: ['CRM Completo', 'Chat IA', 'Funil de Vendas'] },
                  { value: 'performance', name: 'NEXIO GROWTH', price: 'R$ 2.000', icon: TrendingUp, color: 'from-purple-500/20 to-purple-600/20', features: ['Tudo do SALES', '+ Leads ICP', 'Extração Inteligente'] },
                  { value: 'advanced', name: 'NEXIO ADS', price: 'R$ 2.600', icon: Zap, color: 'from-orange-500/20 to-orange-600/20', features: ['Tudo do GROWTH', '+ Gestão de Tráfego', 'Facebook Ads'] },
                ].map((plan) => {
                  const PlanIcon = plan.icon;
                  const isSelected = formData.plan_type === plan.value;

                  return (
                    <button
                      key={plan.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, plan_type: plan.value as any })}
                      className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-2 ring-primary'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.15]'
                      }`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${plan.color} opacity-50`} />
                      <div className="relative space-y-3">
                        <div className="flex items-center justify-between">
                          <PlanIcon className="h-6 w-6" />
                          {isSelected && <Check className="h-5 w-5 text-primary" />}
                        </div>
                        <div>
                          <p className="font-semibold">{plan.name}</p>
                          <p className="text-lg font-bold text-primary">{plan.price}<span className="text-sm text-muted-foreground">/mês</span></p>
                        </div>
                        <ul className="space-y-1">
                          {plan.features.map((feature) => (
                            <li key={feature} className="text-xs text-muted-foreground flex items-center gap-1">
                              <Check className="h-3 w-3" /> {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </button>
                  );
                })}
              </div>
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
          </div>
        </div>
      </form>
    </div>
  );
}
