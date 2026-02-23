'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  Megaphone,
  FileText,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Send,
  MessageSquare,
  Zap,
  BarChart3,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  company_id: number;
  nome?: string;
  name?: string;
  status?: string;
  created_at: string;
  template_id?: number;
  total_enviadas?: number;
  total_respondidas?: number;
  total_erros?: number;
  [key: string]: any;
}

interface CampaignError {
  id: number;
  campaign_id?: number;
  lead_id?: number;
  error_message?: string;
  mensagem?: string;
  created_at: string;
  [key: string]: any;
}

interface Template {
  id: number;
  company_id?: number;
  categoria: string;
  prompt_sistema?: string;
  exemplos?: any;
  ativo: boolean;
  performance_score?: number;
  [key: string]: any;
}

interface OutboundLimit {
  id?: number;
  company_id?: number;
  limite_diario?: number;
  mensagens_enviadas_hoje?: number;
  taxa_resposta?: number;
  mensagens_nao_respondidas_seguidas?: number;
  [key: string]: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CampaignStatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase() || '';
  if (s === 'ativa' || s === 'active' || s === 'running')
    return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">Ativa</Badge>;
  if (s === 'concluída' || s === 'completed' || s === 'done')
    return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-xs">Concluída</Badge>;
  if (s === 'pausada' || s === 'paused')
    return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">Pausada</Badge>;
  if (s === 'erro' || s === 'error' || s === 'failed')
    return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-xs">Erro</Badge>;
  return <Badge variant="secondary" className="text-xs">{status || 'Pendente'}</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OutboundPage() {
  const { company } = useUser();
  const supabase = createClient();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignErrors, setCampaignErrors] = useState<Record<number, CampaignError[]>>({});
  const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null);
  const [campaignPage, setCampaignPage] = useState(0);
  const CAMPAIGNS_PER_PAGE = 6;
  const [templates, setTemplates] = useState<Template[]>([]);
  const [limits, setLimits] = useState<OutboundLimit>({});
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null);
  const [templateDraft, setTemplateDraft] = useState<Partial<Template>>({});
  const [totalEnviadas, setTotalEnviadas] = useState(0);
  const [totalAbordados, setTotalAbordados] = useState(0);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchCampaigns = useCallback(async () => {
    if (!company?.id) return;
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase
        .from('outbound_campaigns')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCampaigns(data || []);
    } catch (err: any) {
      console.error('fetchCampaigns:', err);
    } finally {
      setLoadingCampaigns(false);
    }
  }, [company?.id]);

  const fetchCampaignErrors = useCallback(async (campaignId: number) => {
    try {
      const { data, error } = await supabase
        .from('outbound_campaigns_errors')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setCampaignErrors((prev) => ({ ...prev, [campaignId]: data || [] }));
    } catch (err: any) {
      console.error('fetchCampaignErrors:', err);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    if (!company?.id) return;
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('outbound_templates')
        .select('*')
        .or(`company_id.eq.${company.id},company_id.is.null`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      console.error('fetchTemplates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, [company?.id]);

  const fetchOutboundStats = useCallback(async () => {
    if (!company?.id) return;
    const { data: enviadasRows } = await supabase
      .from('outbound_campaigns')
      .select('id')
      .eq('company_id', company.id)
      .eq('status', 'enviado');
    const { data: abordadosRows } = await supabase
      .from('outbound_campaigns')
      .select('lead_id')
      .eq('company_id', company.id)
      .gt('tentativas', 0);
    setTotalEnviadas(enviadasRows?.length ?? 0);
    setTotalAbordados(new Set(abordadosRows?.map((r: any) => r.lead_id)).size);
  }, [company?.id]);

  const fetchLimits = useCallback(async () => {
    if (!company?.id) return;
    setLoadingLimits(true);
    try {
      const { data, error } = await supabase
        .from('outbound_limits')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        setLimits(data[0]);
      }
    } catch (err: any) {
      console.error('fetchLimits:', err);
    } finally {
      setLoadingLimits(false);
    }
  }, [company?.id]);

  useEffect(() => {
    if (company?.id) {
      fetchCampaigns();
      fetchTemplates();
      fetchLimits();
      fetchOutboundStats();
    }
  }, [company?.id, fetchCampaigns, fetchTemplates, fetchLimits, fetchOutboundStats]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleExpandCampaign = (id: number) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
    } else {
      setExpandedCampaign(id);
      if (!campaignErrors[id]) fetchCampaignErrors(id);
    }
  };

  const handleSaveLimits = async () => {
    if (!company?.id) return;
    setSavingLimits(true);
    try {
      const res = await fetch('/api/outbound/limits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: company.id, limite_diario: limits.limite_diario }),
      });
      if (!res.ok) {
        const { message } = await res.json().catch(() => ({}));
        throw new Error(message || 'Erro ao salvar');
      }
      await fetchLimits();
      toast({ title: 'Configurações salvas!' });
    } catch (err: any) {
      console.error('handleSaveLimits error:', err);
      toast({ title: 'Erro ao salvar configurações', variant: 'destructive' });
    } finally {
      setSavingLimits(false);
    }
  };

  const handleToggleTemplate = async (template: Template) => {
    const newValue = !template.ativo;
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, ativo: newValue } : t)));
    try {
      const { error } = await supabase
        .from('outbound_templates')
        .update({ ativo: newValue })
        .eq('id', template.id);
      if (error) throw error;
      toast({ title: newValue ? 'Template ativado' : 'Template desativado' });
    } catch {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, ativo: !newValue } : t)));
      toast({ title: 'Erro ao atualizar template', variant: 'destructive' });
    }
  };

  const handleStartEdit = (template: Template) => {
    setEditingTemplate(template.id);
    setTemplateDraft({
      categoria: template.categoria,
      prompt_sistema: template.prompt_sistema || '',
      exemplos:
        typeof template.exemplos === 'object'
          ? JSON.stringify(template.exemplos, null, 2)
          : template.exemplos || '',
    });
  };

  const handleSaveTemplate = async (templateId: number) => {
    setSavingTemplate(true);
    try {
      let exemplosValue: any = templateDraft.exemplos;
      try {
        exemplosValue = JSON.parse(templateDraft.exemplos as string);
      } catch {
        // manter como string se não for JSON válido
      }
      const { error } = await supabase
        .from('outbound_templates')
        .update({
          categoria: templateDraft.categoria,
          prompt_sistema: templateDraft.prompt_sistema,
          exemplos: exemplosValue,
        })
        .eq('id', templateId);
      if (error) throw error;
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, ...templateDraft, exemplos: exemplosValue } : t))
      );
      setEditingTemplate(null);
      toast({ title: 'Template atualizado!' });
    } catch {
      toast({ title: 'Erro ao salvar template', variant: 'destructive' });
    } finally {
      setSavingTemplate(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Outbound
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Campanhas automáticas criadas pela IA, templates e limites de disparo
        </p>
      </div>

      <Tabs defaultValue="campanhas" className="space-y-4">
        <TabsList className="self-start">
          <TabsTrigger value="campanhas" className="gap-2">
            <Send className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* ── Campanhas ─────────────────────────────────────────────────────── */}
        <TabsContent value="campanhas" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Criadas automaticamente pela IA</p>
            <Button variant="outline" size="sm" onClick={() => { fetchCampaigns(); fetchOutboundStats(); }} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>

          <div className="flex gap-6 px-1">
            <div>
              <p className="text-2xl font-bold">{totalEnviadas}</p>
              <p className="text-xs text-muted-foreground">Total enviadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAbordados}</p>
              <p className="text-xs text-muted-foreground">Leads abordados</p>
            </div>
          </div>

          {loadingCampaigns ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-accent/30 animate-pulse" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <Megaphone className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Nenhuma campanha ainda</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs">
                  A IA cria campanhas automaticamente conforme os leads são qualificados
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
              {campaigns.slice(campaignPage * CAMPAIGNS_PER_PAGE, (campaignPage + 1) * CAMPAIGNS_PER_PAGE).map((campaign) => {
                const isExpanded = expandedCampaign === campaign.id;
                const errors = campaignErrors[campaign.id] || [];
                const name = campaign.nome || campaign.name || `Campanha #${campaign.id}`;
                const enviadas = campaign.tentativas ?? 0;
                const respondidas = campaign.total_respondidas ?? campaign.respostas ?? 0;
                const erros = campaign.total_erros ?? campaign.erros ?? 0;
                const taxa = enviadas > 0 ? Math.round((respondidas / enviadas) * 100) : 0;

                return (
                  <Card key={campaign.id} className="overflow-hidden">
                    <div
                      className="px-4 py-3 cursor-pointer hover:bg-accent/20 transition-colors"
                      onClick={() => handleExpandCampaign(campaign.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{name}</span>
                            <CampaignStatusBadge status={campaign.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {campaign.created_at ? formatDateTime(campaign.created_at) : '—'}
                          </p>
                        </div>

                        <div className="hidden sm:flex items-center gap-5 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Enviadas</p>
                            <p className="text-sm font-semibold">{enviadas}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Responderam</p>
                            <p className="text-sm font-semibold text-emerald-600">{respondidas}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Taxa</p>
                            <p className="text-sm font-semibold text-primary">{taxa}%</p>
                          </div>
                          {erros > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground">Erros</p>
                              <p className="text-sm font-semibold text-red-500">{erros}</p>
                            </div>
                          )}
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border/50 px-4 py-3 space-y-3 bg-accent/10">
                        {/* Stats mobile */}
                        <div className="grid grid-cols-4 gap-2 sm:hidden text-center">
                          {[
                            { label: 'Enviadas', value: enviadas, color: '' },
                            { label: 'Responderam', value: respondidas, color: 'text-emerald-600' },
                            { label: 'Taxa', value: `${taxa}%`, color: 'text-primary' },
                            { label: 'Erros', value: erros, color: erros > 0 ? 'text-red-500' : '' },
                          ].map((stat) => (
                            <div key={stat.label} className="bg-background rounded-lg p-2">
                              <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                              <p className={`text-sm font-semibold ${stat.color}`}>{stat.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Erros */}
                        {errors.length > 0 ? (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                              Erros ({errors.length})
                            </p>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {errors.map((err) => (
                                <div
                                  key={err.id}
                                  className="text-xs bg-red-500/5 border border-red-500/10 rounded px-3 py-2 flex items-start gap-2"
                                >
                                  <span className="text-red-600 flex-1">
                                    {err.error_message || err.mensagem || JSON.stringify(err)}
                                  </span>
                                  {err.created_at && (
                                    <span className="text-muted-foreground shrink-0">
                                      {formatDateTime(err.created_at)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Nenhum erro registrado nesta campanha
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
              </div>

              {/* Paginação */}
              {campaigns.length > CAMPAIGNS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    {campaignPage * CAMPAIGNS_PER_PAGE + 1}–
                    {Math.min((campaignPage + 1) * CAMPAIGNS_PER_PAGE, campaigns.length)} de{' '}
                    {campaigns.length} campanhas
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={campaignPage === 0}
                      onClick={() => { setCampaignPage((p) => p - 1); setExpandedCampaign(null); }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {campaignPage + 1} / {Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={(campaignPage + 1) * CAMPAIGNS_PER_PAGE >= campaigns.length}
                      onClick={() => { setCampaignPage((p) => p + 1); setExpandedCampaign(null); }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Templates ─────────────────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Prompts que a IA usa para gerar mensagens de abordagem
            </p>
            <Button variant="outline" size="sm" onClick={fetchTemplates} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>

          {loadingTemplates ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-accent/30 animate-pulse" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-14 gap-3 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum template encontrado</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs">
                  Os templates são configurados pela equipe Nexio e aparecem aqui para edição
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => {
                const isEditing = editingTemplate === template.id;
                const score = template.performance_score;

                return (
                  <Card key={template.id} className="overflow-hidden">
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{template.categoria}</span>
                            {score !== undefined && score !== null && (
                              <Badge
                                className={
                                  score >= 70
                                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs'
                                    : score >= 40
                                    ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs'
                                    : 'bg-red-500/15 text-red-600 border-red-500/30 text-xs'
                                }
                              >
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {score}% performance
                              </Badge>
                            )}
                          </div>
                          {!isEditing && template.prompt_sistema && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {template.prompt_sistema}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={template.ativo}
                              onCheckedChange={() => handleToggleTemplate(template)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              {template.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                          {!isEditing ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(template)}>
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTemplate(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {isEditing && (
                        <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Categoria / Nome</Label>
                            <Input
                              value={templateDraft.categoria || ''}
                              onChange={(e) => setTemplateDraft((d) => ({ ...d, categoria: e.target.value }))}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Prompt do Sistema</Label>
                            <Textarea
                              value={templateDraft.prompt_sistema || ''}
                              onChange={(e) => setTemplateDraft((d) => ({ ...d, prompt_sistema: e.target.value }))}
                              className="min-h-[100px] text-sm resize-y"
                              placeholder="Instruções para a IA gerar a mensagem de abordagem..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Exemplos (JSON)</Label>
                            <Textarea
                              value={
                                typeof templateDraft.exemplos === 'string'
                                  ? templateDraft.exemplos
                                  : JSON.stringify(templateDraft.exemplos, null, 2)
                              }
                              onChange={(e) => setTemplateDraft((d) => ({ ...d, exemplos: e.target.value }))}
                              className="min-h-[80px] text-xs font-mono resize-y"
                              placeholder='[{"entrada": "...", "saida": "..."}]'
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingTemplate(null)}>
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveTemplate(template.id)}
                              disabled={savingTemplate}
                              className="gap-1.5"
                            >
                              <Save className="h-3.5 w-3.5" />
                              {savingTemplate ? 'Salvando...' : 'Salvar'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Configurações ─────────────────────────────────────────────────── */}
        <TabsContent value="configuracoes" className="space-y-4">
          {loadingLimits ? (
            <div className="h-48 rounded-lg bg-accent/30 animate-pulse" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Limite de disparos */}
              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Limite de Disparos
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Limite diário de mensagens</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={limits.limite_diario ?? ''}
                      onChange={(e) =>
                        setLimits((prev) => ({ ...prev, limite_diario: Number(e.target.value) }))
                      }
                      className="h-10"
                      placeholder="Ex: 50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Máximo de mensagens enviadas por dia pela IA
                    </p>
                  </div>
                  <div className="mt-auto pt-4">
                    <Button onClick={handleSaveLimits} disabled={savingLimits} className="w-full gap-1.5">
                      <Save className="h-4 w-4" />
                      {savingLimits ? 'Salvando...' : 'Salvar configurações'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Métricas de hoje */}
              <Card className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Métricas de Hoje
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 space-y-0">
                  {[
                    {
                      icon: Send,
                      label: 'Enviadas hoje',
                      value: limits.mensagens_enviadas_hoje !== undefined
                        ? `${limits.mensagens_enviadas_hoje}${limits.limite_diario ? ` / ${limits.limite_diario}` : ''}`
                        : '0',
                      color: '',
                    },
                    {
                      icon: MessageSquare,
                      label: 'Taxa de resposta',
                      value: limits.taxa_resposta !== undefined
                        ? `${Number(limits.taxa_resposta).toFixed(1)}%`
                        : '—',
                      color: 'text-emerald-600',
                    },
                    {
                      icon: AlertCircle,
                      label: 'Não respondidas seguidas',
                      value: String(limits.mensagens_nao_respondidas_seguidas ?? 0),
                      color:
                        (limits.mensagens_nao_respondidas_seguidas ?? 0) >= 5
                          ? 'text-red-500'
                          : '',
                    },
                  ].map((item, i, arr) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center justify-between py-3 ${
                          i < arr.length - 1 ? 'border-b border-border/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </div>
                        <span className={`font-semibold text-sm ${item.color}`}>{item.value}</span>
                      </div>
                    );
                  })}
                  <div className="mt-auto pt-4">
                    <Button variant="outline" className="w-full gap-1.5" onClick={fetchLimits}>
                      <RefreshCw className="h-4 w-4" />
                      Atualizar métricas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
