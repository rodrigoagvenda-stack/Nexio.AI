'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Target, Loader2, Trash2, Edit, Download, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  nichos?: string[];
  tamanho_empresas?: string;
  tempo_mercado?: string;
  empresa_funcionarios?: number;
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
  const [editingLead, setEditingLead] = useState<ICPLead | null>(null);
  const [deletingLead, setDeletingLead] = useState<ICPLead | null>(null);
  const [extractionsRemaining, setExtractionsRemaining] = useState<number>(0);
  const [extractionsLimit, setExtractionsLimit] = useState<number>(0);

  useEffect(() => {
    if (company?.id) {
      fetchData();
    }
  }, [company]);

  async function fetchData() {
    try {
      const supabase = createClient();

      // Buscar dados da empresa (plan_id)
      const { data: companyData } = await supabase
        .from('companies')
        .select('plan_id')
        .eq('id', company?.id)
        .single();

      let limit = 0;

      // Buscar limite de extrações do plano
      if (companyData?.plan_id) {
        const { data: planData } = await supabase
          .from('plans')
          .select('extraction_limit')
          .eq('id', companyData.plan_id)
          .single();

        if (planData) {
          limit = planData.extraction_limit || 0;
          setExtractionsLimit(limit);
        }
      }

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
      const { data: leads, error: leadsError } = await supabase
        .from('ICP_leads')
        .select('*')
        .eq('company_id', company?.id)
        .order('created_at', { ascending: false });

      console.log('[LEAD-PRO] Leads buscados:', leads);
      console.log('[LEAD-PRO] Erro ao buscar leads:', leadsError);
      console.log('[LEAD-PRO] Company ID:', company?.id);

      const totalLeads = leads?.length || 0;
      setICPLeads(leads || []);

      // Calcular extrações restantes
      const remaining = Math.max(0, limit - totalLeads);
      setExtractionsRemaining(remaining);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleExtract() {
    if (!icpConfig) {
      toast.error('ICP não configurado. Entre em contato com o admin.');
      return;
    }

    setExtracting(true);
    try {
      console.log('[FRONTEND] Enviando requisição para extrair leads ICP...');
      const response = await fetch('/api/extraction/icp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: company?.id }),
      });

      const data = await response.json();
      console.log('[FRONTEND] Resposta da API:', data);

      if (!response.ok) {
        console.error('[FRONTEND] ERRO COMPLETO:', data);
        console.error('[FRONTEND] Stack trace:', data.error?.stack);
        throw new Error(data.message);
      }

      toast.success(`${data.extractedCount || 0} leads extraídos com sucesso!`);

      // Criar notificação
      const supabase = createClient();
      await supabase.from('notifications').insert({
        company_id: company?.id,
        title: 'Leads ICP Extraídos',
        message: `${data.extractedCount || 0} novos leads foram extraídos com sucesso baseados no seu ICP.`,
        type: 'success',
        read: false,
      });

      await fetchData();
    } catch (error: any) {
      console.error('[FRONTEND] Erro ao extrair leads:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">VendAgro</h1>
            <p className="text-muted-foreground mt-1">
              Extração automática de leads baseada no seu Perfil de Cliente Ideal (ICP)
            </p>
          </div>
          {/* Contador SEMPRE visível */}
          <div className="flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-lg">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Extrações Restantes</p>
              <p className="text-2xl font-bold text-primary">
                {extractionsLimit > 0 ? extractionsRemaining : '∞'}
              </p>
            </div>
            {extractionsLimit > 0 && (
              <div className="text-xs text-muted-foreground">
                de {extractionsLimit}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ICP Configuration - DESTACADO NO TOPO */}
      {!icpConfig ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>ICP não configurado</AlertTitle>
          <AlertDescription>
            O admin ainda não configurou o Perfil de Cliente Ideal (ICP) para sua empresa.
            Entre em contato com o administrador para ativar a extração de leads.
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="border-2 border-primary/20">
          <CardHeader className="bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Perfil de Cliente Ideal (ICP)</CardTitle>
                  <CardDescription>Configuração definida pelo administrador</CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                Read-Only
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Demográfico */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  Perfil Demográfico
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pl-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Faixa Etária</p>
                    <p className="text-sm font-medium">
                      {icpConfig.idade_min && icpConfig.idade_max
                        ? `${icpConfig.idade_min} - ${icpConfig.idade_max} anos`
                        : 'Não definido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Gênero</p>
                    <p className="text-sm font-medium">{icpConfig.genero || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Escolaridade</p>
                    <p className="text-sm font-medium">{icpConfig.escolaridade || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Nichos</p>
                    <p className="text-sm font-medium">{icpConfig.nichos?.join(', ') || 'Não definido'}</p>
                  </div>
                </div>
              </div>

              {/* Empresa */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  Perfil da Empresa
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pl-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Tamanho</p>
                    <p className="text-sm font-medium">{icpConfig.tamanho_empresas || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Tempo de Mercado</p>
                    <p className="text-sm font-medium">{icpConfig.tempo_mercado || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Nº Funcionários</p>
                    <p className="text-sm font-medium">{icpConfig.empresa_funcionarios || 'Não definido'}</p>
                  </div>
                </div>
              </div>

              {/* Comunicação */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  Preferências de Comunicação
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pl-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Canais</p>
                    <p className="text-sm font-medium">{icpConfig.canais?.join(', ') || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Preferência</p>
                    <p className="text-sm font-medium">{icpConfig.preferencia_contato || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Horário</p>
                    <p className="text-sm font-medium">{icpConfig.horario || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Tom de Voz</p>
                    <p className="text-sm font-medium">{icpConfig.linguagem || 'Não definido'}</p>
                  </div>
                </div>
              </div>

              {/* Comportamento */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  Perfil Comportamental
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pl-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Ciclo de Compra</p>
                    <p className="text-sm font-medium">{icpConfig.ciclo_compra || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Budget</p>
                    <p className="text-sm font-medium">
                      {icpConfig.budget_min && icpConfig.budget_max
                        ? `R$ ${icpConfig.budget_min.toLocaleString()} - R$ ${icpConfig.budget_max.toLocaleString()}`
                        : 'Não definido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Compra Online</p>
                    <p className="text-sm font-medium">{icpConfig.comprou_online ? 'Sim' : 'Não'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Influenciável</p>
                    <p className="text-sm font-medium">{icpConfig.influenciador ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
              </div>

              {/* Dores e Objetivos */}
              {(icpConfig.dores || icpConfig.objetivos) && (
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 bg-primary rounded-full"></div>
                    Dores e Objetivos
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pl-3">
                    {icpConfig.dores && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Dores</p>
                        <p className="text-sm">{icpConfig.dores}</p>
                      </div>
                    )}
                    {icpConfig.objetivos && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Objetivos</p>
                        <p className="text-sm">{icpConfig.objetivos}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Configurações de Extração */}
              <div>
                <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 bg-primary rounded-full"></div>
                  Configurações de Extração
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pl-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Leads/Dia</p>
                    <p className="text-sm font-medium">{icpConfig.leads_por_dia_max || 3}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">IA Ativa</p>
                    <Badge variant={icpConfig.usar_ia ? 'default' : 'secondary'} className="text-xs">
                      {icpConfig.usar_ia ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Fins de Semana</p>
                    <Badge variant={icpConfig.entregar_fins_semana ? 'default' : 'secondary'} className="text-xs">
                      {icpConfig.entregar_fins_semana ? 'Sim' : 'Não'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Prioridade</p>
                    <Badge variant="outline" className="text-xs">{icpConfig.prioridade || 'Média'}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão de Extração */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Download className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Extrair Leads ICP</h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
              Clique no botão abaixo para iniciar a extração automática de leads qualificados
              baseados nas configurações do ICP acima. Os leads serão extraídos do Google Sheets.
            </p>
            <Button
              onClick={handleExtract}
              disabled={extracting || !icpConfig}
              size="lg"
              className="w-full max-w-md"
            >
              {extracting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Extraindo Leads...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Extrair Leads ICP
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Leads Extraídos</CardTitle>
              <CardDescription>{icpLeads.length} leads no total</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {icpLeads.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">
                Nenhum lead extraído ainda. Clique em &quot;Extrair Leads ICP&quot; para começar.
              </p>
            </div>
          ) : (
            <>
              {/* Cards Mobile */}
              <div className="md:hidden space-y-4">
                {icpLeads.map((lead) => (
                  <div key={lead.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm">{lead.nome}</h4>
                        <p className="text-sm text-muted-foreground">{lead.empresa}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLead(lead)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingLead(lead)}
                          className="h-8 w-8 p-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">Email:</span>
                        <p className="text-sm">{lead.email}</p>
                      </div>
                      {lead.whatsapp && (
                        <div>
                          <span className="text-xs text-muted-foreground">WhatsApp:</span>
                          <p className="text-sm">{lead.whatsapp}</p>
                        </div>
                      )}
                      {lead.segmento && (
                        <div>
                          <span className="text-xs text-muted-foreground">Segmento:</span>
                          <p className="text-sm">{lead.segmento}</p>
                        </div>
                      )}
                      {lead.cidade && (
                        <div>
                          <span className="text-xs text-muted-foreground">Cidade:</span>
                          <p className="text-sm">{lead.cidade}/{lead.estado}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabela Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[900px]">
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
                      <tr key={lead.id} className="border-b hover:bg-accent transition-colors">
                        <td className="p-3 font-medium text-sm">{lead.nome}</td>
                        <td className="p-3 text-sm">{lead.empresa}</td>
                        <td className="p-3 text-sm text-muted-foreground">{lead.email}</td>
                        <td className="p-3 text-sm text-muted-foreground">{lead.whatsapp}</td>
                        <td className="p-3 text-sm">{lead.segmento}</td>
                        <td className="p-3 text-sm">
                          {lead.cidade ? `${lead.cidade}/${lead.estado}` : '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-2">
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
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
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
