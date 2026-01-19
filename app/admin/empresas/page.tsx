'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Eye, Settings, Trash2, Building2, TrendingUp, Zap } from 'lucide-react';
import { Company } from '@/types/database.types';
import { formatDateTime } from '@/lib/utils/format';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

export default function EmpresasListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const getPlanInfo = (planType: string) => {
    const plans: Record<string, { name: string; price: string; icon: any; color: string }> = {
      basic: { name: 'NEXIO SALES', price: 'R$ 1.600', icon: Building2, color: 'from-blue-500/20 to-blue-600/20' },
      performance: { name: 'NEXIO GROWTH', price: 'R$ 2.000', icon: TrendingUp, color: 'from-purple-500/20 to-purple-600/20' },
      advanced: { name: 'NEXIO ADS', price: 'R$ 2.600', icon: Zap, color: 'from-orange-500/20 to-orange-600/20' },
    };
    return plans[planType] || plans.basic;
  };

  // Calcular paginação
  const totalPages = Math.ceil(companies.length / itemsPerPage);
  const paginatedCompanies = companies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset página quando buscar
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-shimmer h-8 w-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Empresas</h1>
          <p className="text-muted-foreground mt-1">Gerencie as empresas cadastradas</p>
        </div>
        <Link href="/admin/empresas/nova">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
        <div className="p-6 border-b border-white/[0.08]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Empresas ({companies.length})</h2>
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:max-w-sm bg-white/[0.05] border-white/[0.08]"
            />
          </div>
        </div>
        <div className="p-6">
          {companies.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma empresa encontrada</p>
            </div>
          ) : (
            <>
              {/* Cards para Mobile */}
              <div className="md:hidden space-y-4">
                {paginatedCompanies.map((company) => {
                  const planInfo = getPlanInfo(company.plan_type);
                  const PlanIcon = planInfo.icon;

                  return (
                    <div key={company.id} className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-4">
                      <div className={`absolute inset-0 bg-gradient-to-br ${planInfo.color} opacity-50`} />
                      <div className="relative space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-base">{company.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{company.email}</p>
                          </div>
                          {company.is_active ? (
                            <Badge variant="default" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">Ativa</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Inativa</Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Plano</p>
                            <div className="flex items-center gap-2 mt-1">
                              <PlanIcon className="h-3 w-3" />
                              <span className="text-xs font-medium">{planInfo.name}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{planInfo.price}/mês</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">VendAgro</p>
                            {company.vendagro_plan ? (
                              <Badge variant="default" className="text-xs mt-1 bg-purple-500/20 text-purple-300 border-purple-500/30">
                                {company.vendagro_plan}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground">Criado em</p>
                          <p className="text-xs mt-1">{formatDateTime(company.created_at)}</p>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-white/[0.08]">
                          <Link href={`/admin/empresas/${company.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.1]">
                              <Eye className="h-4 w-4 mr-2" />
                              Ver
                            </Button>
                          </Link>
                          {company.vendagro_plan && (
                            <Link href={`/admin/empresas/${company.id}/icp`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full bg-white/[0.05] border-white/[0.08] hover:bg-white/[0.1]">
                                <Settings className="h-4 w-4 mr-2" />
                                ICP
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabela para Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.08]">
                      <th className="text-left p-3 text-sm font-semibold">Empresa</th>
                      <th className="text-left p-3 text-sm font-semibold">Email</th>
                      <th className="text-left p-3 text-sm font-semibold">Plano</th>
                      <th className="text-left p-3 text-sm font-semibold">VendAgro</th>
                      <th className="text-left p-3 text-sm font-semibold">Status</th>
                      <th className="text-left p-3 text-sm font-semibold">Criado</th>
                      <th className="text-left p-3 text-sm font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCompanies.map((company) => {
                      const planInfo = getPlanInfo(company.plan_type);
                      const PlanIcon = planInfo.icon;

                      return (
                        <tr key={company.id} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-medium text-sm">{company.name}</td>
                          <td className="p-3 text-sm text-muted-foreground">{company.email}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <PlanIcon className="h-4 w-4 text-primary" />
                              <div>
                                <p className="text-xs font-medium">{planInfo.name}</p>
                                <p className="text-xs text-muted-foreground">{planInfo.price}/mês</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {company.vendagro_plan ? (
                              <Badge variant="default" className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                                {company.vendagro_plan}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            {company.is_active ? (
                              <Badge variant="default" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                                Ativa
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">Inativa</Badge>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {formatDateTime(company.created_at)}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              <Link href={`/admin/empresas/${company.id}`}>
                                <Button variant="ghost" size="sm" className="hover:bg-white/[0.05]">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              {company.vendagro_plan && (
                                <Link href={`/admin/empresas/${company.id}/icp`}>
                                  <Button variant="ghost" size="sm" className="hover:bg-white/[0.05]">
                                    <Settings className="h-4 w-4" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Paginação */}
        {companies.length > 0 && totalPages > 1 && (
          <div className="p-6 border-t border-white/[0.08]">
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
  );
}
