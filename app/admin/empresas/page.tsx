'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Eye, Settings, Trash2 } from 'lucide-react';
import { Company } from '@/types/database.types';
import { formatDateTime } from '@/lib/utils/format';

export default function EmpresasListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, [search]);

  async function fetchCompanies() {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/api/admin/companies?${params}`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      setCompanies(data.data || []);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      toast.error(error.message || 'Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  }

  const getPlanBadge = (planType: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      basic: 'outline',
      performance: 'secondary',
      advanced: 'default',
    };
    return variants[planType] || 'outline';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🏢 Empresas</h1>
          <p className="text-muted-foreground mt-1">Gerencie as empresas cadastradas</p>
        </div>
        <Link href="/admin/empresas/nova">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Empresas ({companies.length})</CardTitle>
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Empresa</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Plano</th>
                    <th className="text-left p-3">VendAgro</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Criado</th>
                    <th className="text-left p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b hover:bg-accent">
                      <td className="p-3 font-medium">{company.name}</td>
                      <td className="p-3 text-sm text-muted-foreground">{company.email}</td>
                      <td className="p-3">
                        <Badge variant={getPlanBadge(company.plan_type)}>
                          {company.plan_type}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {company.vendagro_plan ? (
                          <Badge variant="default">
                            {company.vendagro_plan}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        {company.is_active ? (
                          <Badge variant="default" className="bg-green-500">
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inativa</Badge>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {formatDateTime(company.created_at)}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Link href={`/admin/empresas/${company.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {company.vendagro_plan && (
                            <Link href={`/admin/empresas/${company.id}/icp`}>
                              <Button variant="ghost" size="sm">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
