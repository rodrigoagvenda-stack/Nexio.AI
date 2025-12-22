'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Target, Loader2, TrendingUp, Trash2, Edit, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ICPLead {
  id: number;
  nome: string;
  empresa: string;
  email: string;
  telefone?: string;
  whatsapp?: string;
  segmento?: string;
  cidade?: string;
  estado?: string;
  created_at: string;
}

interface ICPConfig {
  segmento?: string;
  localizacao?: string;
  faturamento_minimo?: number;
  numero_funcionarios?: number;
  outros_criterios?: string;
}

export default function LeadProPage() {
  const { company } = useUser();
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [icpLeads, setICPLeads] = useState<ICPLead[]>([]);
  const [icpConfig, setICPConfig] = useState<ICPConfig | null>(null);
  const [stats, setStats] = useState({
    extracted: 0,
    limit: 0,
    remaining: 0,
  });
  const [editingLead, setEditingLead] = useState<ICPLead | null>(null);
  const [deletingLead, setDeletingLead] = useState<ICPLead | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company]);

  async function fetchData() {
    try {
      const supabase = createClient();

      // Buscar configuração do ICP
      const { data: icpData } = await supabase
        .from('icp_configuration')
        .select('*')
        .eq('company_id', company?.id)
        .single();

      if (icpData) {
        setICPConfig(icpData);
      }

      // Buscar leads ICP
      const { data: leads } = await supabase
        .from('ICP_leads')
        .select('*')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      setICPLeads(leads || []);

      // Calcular estatísticas
      const extracted = company?.leads_extracted_this_month || 0;
      const limit = company?.plan_monthly_limit || 0;
      const remaining = Math.max(0, limit - extracted);

      setStats({ extracted, limit, remaining });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    setExtracting(true);
    try {
      const response = await fetch('/api/extraction/icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company?.id }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message);

      toast.success(`${data.extractedCount} leads extraídos com sucesso!`);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao extrair leads');
    } finally {
      setExtracting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingLead) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('ICP_leads')
        .update({
          nome: editingLead.nome,
          empresa: editingLead.empresa,
          email: editingLead.email,
          telefone: editingLead.telefone,
          whatsapp: editingLead.whatsapp,
          segmento: editingLead.segmento,
          cidade: editingLead.cidade,
          estado: editingLead.estado,
        })
        .eq('id', editingLead.id);

      if (error) throw error;

      toast.success('Lead atualizado com sucesso!');
      setEditingLead(null);
      await fetchData();
    } catch (error) {
      toast.error('Erro ao atualizar lead');
    }
  }

  async function handleDelete() {
    if (!deletingLead) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('ICP_leads')
        .delete()
        .eq('id', deletingLead.id);

      if (error) throw error;

      toast.success('Lead excluído com sucesso!');
      setDeletingLead(null);
      await fetchData();
    } catch (error) {
      toast.error('Erro ao excluir lead');
    }
  }

  if (!company?.vendagro_plan) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Lead PRO não disponível</h3>
            <p className="text-sm text-muted-foreground">
              Entre em contato com o admin para ativar o módulo VendAgro
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progressPercent = stats.limit > 0 ? (stats.extracted / stats.limit) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Lead PRO - VendAgro</h1>
        <p className="text-muted-foreground mt-1">
          Leads qualificados baseados no seu ICP
        </p>
      </div>

      {/* ICP Configuration (Read-Only) */}
      {icpConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Configuração do ICP
              <span className="text-xs text-muted-foreground font-normal ml-2">
                (Definido pelo Admin)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Segmento</p>
              <p className="text-base">{icpConfig.segmento || 'Não definido'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Localização</p>
              <p className="text-base">{icpConfig.localizacao || 'Não definido'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Faturamento Mínimo</p>
              <p className="text-base">
                {icpConfig.faturamento_minimo
                  ? `R$ ${icpConfig.faturamento_minimo.toLocaleString()}`
                  : 'Não definido'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nº Funcionários</p>
              <p className="text-base">{icpConfig.numero_funcionarios || 'Não definido'}</p>
            </div>
            {icpConfig.outros_criterios && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Outros Critérios</p>
                <p className="text-base">{icpConfig.outros_criterios}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Limite Mensal</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.limit}</div>
            <p className="text-xs text-muted-foreground">leads/mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Extraídos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.extracted}</div>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.remaining}</div>
            <p className="text-xs text-muted-foreground">restantes</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso Mensal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercent} />
          <div className="flex justify-between text-sm">
            <span>{stats.extracted} extraídos</span>
            <span>{stats.limit} limite</span>
          </div>
          <Button
            onClick={handleExtract}
            disabled={extracting || stats.remaining === 0}
            className="w-full"
            size="lg"
          >
            {extracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : stats.remaining === 0 ? (
              'Limite Mensal Atingido'
            ) : (
              'Extrair Leads ICP'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leads Extraídos ({icpLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {icpLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum lead extraído ainda. Clique em &quot;Extrair Leads ICP&quot; para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-semibold">Nome</th>
                    <th className="text-left p-3 text-sm font-semibold">Empresa</th>
                    <th className="text-left p-3 text-sm font-semibold">Email</th>
                    <th className="text-left p-3 text-sm font-semibold">WhatsApp</th>
                    <th className="text-left p-3 text-sm font-semibold">Segmento</th>
                    <th className="text-left p-3 text-sm font-semibold">Cidade</th>
                    <th className="text-right p-3 text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {icpLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-accent/50 transition-colors">
                      <td className="p-3 font-medium">{lead.nome}</td>
                      <td className="p-3">{lead.empresa}</td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.email}</td>
                      <td className="p-3 text-sm text-muted-foreground">{lead.whatsapp}</td>
                      <td className="p-3 text-sm">{lead.segmento}</td>
                      <td className="p-3 text-sm">{lead.cidade ? `${lead.cidade}/${lead.estado}` : '-'}</td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingLead(lead)}
                            title="Editar lead"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingLead(lead)}
                            title="Excluir lead"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
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

      {/* Edit Modal */}
      <Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={editingLead.nome}
                  onChange={(e) => setEditingLead({ ...editingLead, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <Input
                  value={editingLead.empresa}
                  onChange={(e) => setEditingLead({ ...editingLead, empresa: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={editingLead.email}
                  onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">WhatsApp</label>
                <Input
                  value={editingLead.whatsapp || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, whatsapp: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input
                  value={editingLead.telefone || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, telefone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Segmento</label>
                <Input
                  value={editingLead.segmento || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, segmento: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Cidade</label>
                <Input
                  value={editingLead.cidade || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, cidade: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Input
                  value={editingLead.estado || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, estado: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLead(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deletingLead} onOpenChange={() => setDeletingLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p>
            Tem certeza que deseja excluir o lead <strong>{deletingLead?.nome}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingLead(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
