'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { Eye, Search } from 'lucide-react';
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

const PLAN_INFO: Record<string, { name: string; color: string }> = {
  basic:   { name: 'Free',   color: 'text-muted-foreground' },
  starter: { name: 'Start',  color: 'text-blue-400' },
  pro:     { name: 'Growth', color: 'text-primary' },
  scale:   { name: 'Pro',    color: 'text-orange-400' },
};

export default function EmpresasListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchCompanies(); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
      toast({ title: error.message || 'Erro ao carregar empresas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? 'Carregando…' : `${companies.length} empresa${companies.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          className="pl-9 h-9"
        />
      </div>

      {/* Table */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Empresa</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Email</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Plano</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-left py-2.5 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Criado</th>
              <th className="py-2.5 px-4" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-3 px-4"><div className="h-4 w-32 bg-muted/60 rounded animate-pulse" /></td>
                  <td className="py-3 px-4 hidden sm:table-cell"><div className="h-4 w-40 bg-muted/60 rounded animate-pulse" /></td>
                  <td className="py-3 px-4"><div className="h-4 w-16 bg-muted/60 rounded animate-pulse" /></td>
                  <td className="py-3 px-4"><div className="h-5 w-12 bg-muted/60 rounded animate-pulse" /></td>
                  <td className="py-3 px-4 hidden md:table-cell"><div className="h-4 w-24 bg-muted/60 rounded animate-pulse" /></td>
                  <td className="py-3 px-4"><div className="h-7 w-7 bg-muted/60 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : paginatedCompanies.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma empresa encontrada
                </td>
              </tr>
            ) : (
              paginatedCompanies.map((company) => {
                const plan = PLAN_INFO[company.plan_type] ?? PLAN_INFO.basic;
                return (
                  <tr key={company.id} className="border-b border-border/30 hover:bg-accent/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-sm">{company.name}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground hidden sm:table-cell">{company.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-semibold ${plan.color}`}>{plan.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      {company.is_active
                        ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Ativa</span>
                        : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Inativa</span>
                      }
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground hidden md:table-cell">
                      {formatDateTime(company.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/admin/empresas/${company.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {!loading && totalPages > 1 && (
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
      )}
    </div>
  );
}
