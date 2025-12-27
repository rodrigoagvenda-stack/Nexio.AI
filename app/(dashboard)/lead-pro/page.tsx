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
import { Badge } from '@/components/ui/badge';

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
  idade_min?: number;
  idade_max?: number;
  renda_min?: number;
  renda_max?: number;
  genero?: string;
  escolaridade?: string;
  estados?: string[];
  regioes?: string[];
  nichos?: string[];
  tamanho_empresa?: string;
  tempo_mercado?: string;
  empresa_funcionarios?: string;
  canais?: string[];
  preferencia_contato?: string;
  horario?: string;
  linguagem?: string;
  ciclo_compra?: string;
  comprou_online?: boolean;
  influenciador?: boolean;
  budget_min?: number;
  budget_max?: number;
  dores?: string;
  objetivos?: string;
  leads_por_dia_max?: number;
  usar_ia?: boolean;
  entregar_fins_semana?: boolean;
  notificar_novos_leads?: boolean;
  prioridade?: string;
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
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Lead PRO - VendAgro</h1>
        <p className="text-muted-foreground mt-1">
          Leads qualificados baseados no seu ICP
        </p>
      </div>

      {/* ICP Configuration (Read-Only) - TODAS as configurações */}
      {icpConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Target className="h-4 w-4 md:h-5 md:w-5" />
              Configuração do ICP
              <Badge variant="secondary" className="text-xs">
                Definido pelo Admin
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Demográfico */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Perfil Demográfico</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Idade</p>
                    <p className="text-sm">
                      {icpConfig.idade_min && icpConfig.idade_max
                        ? `${icpConfig.idade_min} - ${icpConfig.idade_max} anos`
                        : 'Não definido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Gênero</p>
                    <p className="text-sm">{icpConfig.genero || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Escolaridade</p>
                    <p className="text-sm">{icpConfig.escolaridade || 'Não definido'}</p>
                  </div>
                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-xs font-medium text-muted-foreground">Nichos</p>
                    <p className="text-sm">{icpConfig.nichos?.join(', ') || 'Não definido'}</p>
                  </div>
                </div>
              </div>

              {/* Empresa */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Perfil da Empresa</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tamanho</p>
                    <p className="text-sm">{icpConfig.tamanho_empresa || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Tempo de Mercado</p>
                    <p className="text-sm">{icpConfig.tempo_mercado || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Nº Funcionários</p>
                    <p className="text-sm">{icpConfig.empresa_funcionarios || 'Não definido'}</p>
                  </div>
                </div>
              </div>

              {/* Comunicação */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Preferências de Comunicação</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Canais</p>
                    <p className="text-sm">{icpConfig.canais?.join(', ') || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Preferência</p>
                    <p className="text-sm">{icpConfig.preferencia_contato || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Horário</p>
                    <p className="text-sm">{icpConfig.horario || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Linguagem</p>
                    <p className="text-sm">{icpConfig.linguagem || 'Não definido'}</p>
                  </div>
                </div>
              </div>

              {/* Comportamento */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Perfil Comportamental</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Ciclo de Compra</p>
                    <p className="text-sm">{icpConfig.ciclo_compra || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Budget</p>
                    <p className="text-sm">
                      {icpConfig.budget_min && icpConfig.budget_max
                        ? `R$ ${icpConfig.budget_min.toLocaleString()} - R$ ${icpConfig.budget_max.toLocaleString()}`
                        : 'Não definido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Experiência Online</p>
                    <p className="text-sm">{icpConfig.comprou_online ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Influenciado por Redes</p>
                    <p className="text-sm">{icpConfig.influenciador ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
              </div>

              {/* Dores e Objetivos */}
              {(icpConfig.dores || icpConfig.objetivos) && (
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3">Dores e Objetivos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {icpConfig.dores && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Dores</p>
                        <p className="text-sm">{icpConfig.dores}</p>
                      </div>
                    )}
                    {icpConfig.objetivos && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Objetivos</p>
                        <p className="text-sm">{icpConfig.objetivos}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Configurações de Extração */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3">Configurações de Extração</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Leads/Dia (Máx)</p>
                    <p className="text-sm">{icpConfig.leads_por_dia_max || 3}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Usar IA</p>
                    <p className="text-sm">{icpConfig.usar_ia ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Fins de Semana</p>
                    <p className="text-sm">{icpConfig.entregar_fins_semana ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Prioridade</p>
                    <p className="text-sm">{icpConfig.prioridade || 'Média'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
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
          <CardTitle className="text-base md:text-lg">Progresso Mensal</CardTitle>
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

      {/* Leads Table - Mobile Responsive como CRM */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Leads Extraídos ({icpLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {icpLeads.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                Nenhum lead extraído ainda. Clique em &quot;Extrair Leads ICP&quot; para começar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 md:mx-0">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-semibold">Nome</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-semibold">Empresa</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-semibold">Email</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-semibold">WhatsApp</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-semibold">Segmento</th>
                    <th className="text-left p-2 md:p-3 text-xs md:text-sm font-semibold">Cidade</th>
                    <th className="text-right p-2 md:p-3 text-xs md:text-sm font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {icpLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-accent transition-colors">
                      <td className="p-2 md:p-3 font-medium text-sm">{lead.nome}</td>
                      <td className="p-2 md:p-3 text-sm">{lead.empresa}</td>
                      <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">{lead.email}</td>
                      <td className="p-2 md:p-3 text-xs md:text-sm text-muted-foreground">{lead.whatsapp}</td>
                      <td className="p-2 md:p-3 text-xs md:text-sm">{lead.segmento}</td>
                      <td className="p-2 md:p-3 text-xs md:text-sm">
                        {lead.cidade ? `${lead.cidade}/${lead.estado}` : '-'}
                      </td>
                      <td className="p-2 md:p-3">
                        <div className="flex justify-end gap-1 md:gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingLead(lead)}
                            title="Editar lead"
                          >
                            <Edit className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingLead(lead)}
                            title="Excluir lead"
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
