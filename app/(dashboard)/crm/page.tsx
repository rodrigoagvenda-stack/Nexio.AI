'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Lead } from '@/types/database.types';

export default function CRMPage() {
  const { user } = useUser();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  useEffect(() => {
    if (user?.company_id) {
      fetchLeads();
    }
  }, [user]);

  async function fetchLeads() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', user?.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    'Lead novo',
    'Em contato',
    'Interessado',
    'Proposta enviada',
    'Fechado',
    'Perdido',
  ];

  const getLeadsByStatus = (status: string) => {
    return leads.filter((lead) => lead.status === status);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Lead novo':
        return 'border-blue-500';
      case 'Em contato':
        return 'border-yellow-500';
      case 'Interessado':
        return 'border-orange-500';
      case 'Proposta enviada':
        return 'border-purple-500';
      case 'Fechado':
        return 'border-green-500';
      case 'Perdido':
        return 'border-red-500';
      default:
        return 'border-gray-500';
    }
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
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus leads e oportunidades</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {columns.map((column) => {
            const columnLeads = getLeadsByStatus(column);
            return (
              <div key={column} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{column}</h3>
                  <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                    {columnLeads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnLeads.map((lead) => (
                    <Card
                      key={lead.id}
                      className={`cursor-pointer hover:shadow-lg transition-all border-l-4 ${getStatusColor(
                        lead.status
                      )}`}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-medium text-sm mb-1">{lead.company_name}</h4>
                        {lead.contact_name && (
                          <p className="text-xs text-muted-foreground">{lead.contact_name}</p>
                        )}
                        {lead.project_value && (
                          <p className="text-xs font-semibold text-primary mt-2">
                            R$ {lead.project_value.toLocaleString('pt-BR')}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              lead.priority === 'Alta'
                                ? 'bg-red-500/20 text-red-500'
                                : lead.priority === 'Média'
                                ? 'bg-yellow-500/20 text-yellow-500'
                                : 'bg-gray-500/20 text-gray-500'
                            }`}
                          >
                            {lead.priority}
                          </span>
                          <span className="text-xs">{lead.nivel_interesse}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Todos os Leads ({leads.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Empresa</th>
                    <th className="text-left p-3">Contato</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Prioridade</th>
                    <th className="text-left p-3">Temperatura</th>
                    <th className="text-left p-3">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-accent cursor-pointer">
                      <td className="p-3 font-medium">{lead.company_name}</td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {lead.contact_name || '-'}
                      </td>
                      <td className="p-3">
                        <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            lead.priority === 'Alta'
                              ? 'bg-red-500/20 text-red-500'
                              : lead.priority === 'Média'
                              ? 'bg-yellow-500/20 text-yellow-500'
                              : 'bg-gray-500/20 text-gray-500'
                          }`}
                        >
                          {lead.priority}
                        </span>
                      </td>
                      <td className="p-3 text-sm">{lead.nivel_interesse}</td>
                      <td className="p-3 font-semibold text-primary">
                        {lead.project_value
                          ? `R$ ${lead.project_value.toLocaleString('pt-BR')}`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
