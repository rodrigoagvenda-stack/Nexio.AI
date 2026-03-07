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
  Edit3,
  Save,
  X,
  Bell,
  Users,
  Activity,
  ShieldCheck,
  BarChart3,
  Target,
  Repeat2,
  Calendar,
  Video,
  Copy,
  Clock,
  CalendarCheck,
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

interface Meeting {
  id: string;
  contact_name?: string;
  company_name?: string;
  call_status: string;
  meet_url?: string;
  call_agendada_para?: string;
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

// ─── Anti Noshow config ───────────────────────────────────────────────────────

const NOSHOW_STAGES = [
  { label: '24h antes',   keys: ['24h', '24h_antes',  'antecipacao', '24'] },
  { label: '2h antes',    keys: ['2h',  '2h_antes',   'reforco']          },
  { label: '15min antes', keys: ['15min','15min_antes','15']               },
  { label: '5min após',   keys: ['5min','5min_apos',  '5min_após','resgate','5'] },
];

const noshowColors = ['#4c1d95', '#6d28d9', '#8b5cf6', '#a78bfa'];

function resolveNoshowCount(counts: Record<string, number>, keys: string[]): number {
  for (const [k, v] of Object.entries(counts)) {
    if (keys.some((key) => k.toLowerCase().includes(key.toLowerCase()))) return v;
  }
  return 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color ?? ''}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

function MeetingStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'agendada':
      return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-xs">Agendada</Badge>;
    case 'confirmada':
      return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs">Confirmada</Badge>;
    case 'realizada':
      return <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-xs">Realizada</Badge>;
    case 'no_show':
      return <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-xs">No-show</Badge>;
    case 'cancelada':
      return <Badge className="bg-zinc-500/15 text-zinc-500 border-zinc-500/30 text-xs">Cancelada</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">{status}</Badge>;
  }
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
  const [antiNoshowCounts, setAntiNoshowCounts] = useState<Record<string, number>>({});
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingFilter, setMeetingFilter] = useState<'proximas' | 'passadas'>('proximas');

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadingLimits, setLoadingLimits] = useState(true);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
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
      if (data && data.length > 0) setLimits(data[0]);
    } catch (err: any) {
      console.error('fetchLimits:', err);
    } finally {
      setLoadingLimits(false);
    }
  }, [company?.id]);

  const fetchAntiNoshow = useCallback(async () => {
    if (!company?.id) return;
    const { data } = await supabase
      .from('follow_logs')
      .select('momento')
      .eq('company_id', company.id);
    if (!data) return;
    const counts: Record<string, number> = {};
    for (const row of data) {
      if (row.momento) counts[row.momento] = (counts[row.momento] ?? 0) + 1;
    }
    setAntiNoshowCounts(counts);
  }, [company?.id]);

  const fetchMeetings = useCallback(async () => {
    if (!company?.id) return;
    setLoadingMeetings(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, contact_name, company_name, call_status, meet_url, call_agendada_para')
        .eq('company_id', company.id)
        .not('call_status', 'is', null)
        .order('call_agendada_para', { ascending: true });
      if (error) throw error;
      setMeetings(data || []);
    } catch (err: any) {
      console.error('fetchMeetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  }, [company?.id]);

  useEffect(() => {
    if (company?.id) {
      fetchCampaigns();
      fetchTemplates();
      fetchLimits();
      fetchOutboundStats();
      fetchAntiNoshow();
      fetchMeetings();
    }
  }, [company?.id, fetchCampaigns, fetchTemplates, fetchLimits, fetchOutboundStats, fetchAntiNoshow, fetchMeetings]);

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
      try { exemplosValue = JSON.parse(templateDraft.exemplos as string); } catch {}
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

  // ─── Derived data ────────────────────────────────────────────────────────────

  const noshowData = NOSHOW_STAGES.map((s, i) => ({
    name: s.label,
    quantidade: resolveNoshowCount(antiNoshowCounts, s.keys),
    fill: noshowColors[i],
  }));
  const noshowTotal = noshowData.reduce((acc, d) => acc + d.quantidade, 0);

  const enviadas_hoje = limits.mensagens_enviadas_hoje ?? 0;
  const taxa = limits.taxa_resposta !== undefined ? `${Number(limits.taxa_resposta).toFixed(1)}%` : '—';

  // Meeting stats
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(todayStart.getTime() + 86400000);
  const weekEnd    = new Date(todayStart.getTime() + 7 * 86400000);

  const meetingsHoje   = meetings.filter((m) => {
    if (!m.call_agendada_para) return false;
    const d = new Date(m.call_agendada_para);
    return d >= todayStart && d < todayEnd;
  });
  const meetingsSemana = meetings.filter((m) => {
    if (!m.call_agendada_para) return false;
    const d = new Date(m.call_agendada_para);
    return d >= todayStart && d < weekEnd;
  });
  const noShows = meetings.filter((m) => m.call_status === 'no_show');

  const proximasMeetings = meetings.filter((m) => {
    if (!m.call_agendada_para) return false;
    return new Date(m.call_agendada_para) >= todayStart;
  });
  const passadasMeetings = meetings.filter((m) => {
    if (!m.call_agendada_para) return true;
    return new Date(m.call_agendada_para) < todayStart;
  });
  const displayedMeetings = meetingFilter === 'proximas' ? proximasMeetings : passadasMeetings;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          Automação
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Outbound, Reuniões, Anti Noshow e Remarketing via IA
        </p>
      </div>

      {/* Aviso de horário */}
      <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        <div className="space-y-0.5 text-sm">
          <p className="font-semibold text-foreground">Orbit.AI — Horário de operação</p>
          <p className="text-muted-foreground leading-relaxed">
            Segunda a sexta, das <strong className="text-foreground">9h às 18h</strong> (Brasília). Fora desse período o sistema entra em repouso automaticamente.
          </p>
          <a href="/ajuda?tab=outbound" className="inline-block text-amber-500 hover:text-amber-400 underline underline-offset-2 text-xs font-medium mt-0.5">
            Saiba mais no FAQ →
          </a>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="campanhas" className="space-y-4">
        <TabsList className="self-start flex-wrap h-auto gap-1">
          <TabsTrigger value="campanhas" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="reunioes" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Reuniões
            {meetingsHoje.length > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                {meetingsHoje.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="noshow" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Anti Noshow
          </TabsTrigger>
          <TabsTrigger value="remarketing" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Remarketing
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* ── Campanhas ─────────────────────────────────────────────────────── */}
        <TabsContent value="campanhas" className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={Send} label="Total enviadas" value={totalEnviadas} />
            <KpiCard icon={Users} label="Leads abordados" value={totalAbordados} />
            <KpiCard
              icon={Activity}
              label="Enviadas hoje"
              value={enviadas_hoje}
              sub={limits.limite_diario ? `Limite: ${limits.limite_diario}` : undefined}
              color={(limits.mensagens_nao_respondidas_seguidas ?? 0) >= 5 ? 'text-red-500' : ''}
            />
            <KpiCard icon={MessageSquare} label="Taxa de resposta" value={taxa} color="text-emerald-600" />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Criadas automaticamente pela IA</p>
            <Button variant="outline" size="sm" onClick={() => { fetchCampaigns(); fetchOutboundStats(); }} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
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
                  const taxaC = enviadas > 0 ? Math.round((respondidas / enviadas) * 100) : 0;

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
                              <p className="text-sm font-semibold text-primary">{taxaC}%</p>
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
                              { label: 'Taxa', value: `${taxaC}%`, color: 'text-primary' },
                              { label: 'Erros', value: erros, color: erros > 0 ? 'text-red-500' : '' },
                            ].map((stat) => (
                              <div key={stat.label} className="bg-background rounded-lg p-2">
                                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                                <p className={`text-sm font-semibold ${stat.color}`}>{stat.value}</p>
                              </div>
                            ))}
                          </div>

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

              {campaigns.length > CAMPAIGNS_PER_PAGE && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    {campaignPage * CAMPAIGNS_PER_PAGE + 1}–
                    {Math.min((campaignPage + 1) * CAMPAIGNS_PER_PAGE, campaigns.length)} de{' '}
                    {campaigns.length} campanhas
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
                      disabled={campaignPage === 0}
                      onClick={() => { setCampaignPage((p) => p - 1); setExpandedCampaign(null); }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {campaignPage + 1} / {Math.ceil(campaigns.length / CAMPAIGNS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
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

        {/* ── Reuniões ──────────────────────────────────────────────────────── */}
        <TabsContent value="reunioes" className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard icon={Calendar}     label="Hoje"         value={meetingsHoje.length}   sub="reuniões agendadas" />
            <KpiCard icon={CalendarCheck} label="Esta semana" value={meetingsSemana.length}  sub="próximos 7 dias" />
            <KpiCard icon={Video}        label="Total"        value={meetings.length}        sub="todas as reuniões" />
            <KpiCard icon={AlertCircle}  label="No-shows"     value={noShows.length}         color={noShows.length > 0 ? 'text-red-500' : ''} />
          </div>

          {/* Filtro */}
          <div className="flex items-center justify-between">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setMeetingFilter('proximas')}
                className={`px-4 py-1.5 text-sm transition-colors ${
                  meetingFilter === 'proximas'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                Próximas ({proximasMeetings.length})
              </button>
              <button
                onClick={() => setMeetingFilter('passadas')}
                className={`px-4 py-1.5 text-sm transition-colors border-l border-border ${
                  meetingFilter === 'passadas'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                }`}
              >
                Passadas ({passadasMeetings.length})
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMeetings} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
          </div>

          {/* Lista */}
          {loadingMeetings ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-accent/30 animate-pulse" />)}
            </div>
          ) : displayedMeetings.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">
                  {meetingFilter === 'proximas' ? 'Nenhuma reunião próxima' : 'Nenhuma reunião passada'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {displayedMeetings.map((m) => (
                <Card key={m.id} className="overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.company_name || m.contact_name || 'Lead sem nome'}</span>
                        {m.contact_name && m.company_name && (
                          <span className="text-xs text-muted-foreground truncate">· {m.contact_name}</span>
                        )}
                        <MeetingStatusBadge status={m.call_status} />
                      </div>
                      {m.call_agendada_para && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(m.call_agendada_para).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>

                    {/* Meet link */}
                    {m.meet_url ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={m.meet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Entrar
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            navigator.clipboard.writeText(m.meet_url!);
                            toast({ title: 'Link copiado!' });
                          }}
                          title="Copiar link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50 shrink-0">Sem link</span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Anti Noshow ───────────────────────────────────────────────────── */}
        <TabsContent value="noshow" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Mensagens de confirmação enviadas por etapa</p>
            <div className="flex items-center gap-3">
              {noshowTotal > 0 && (
                <span className="text-sm font-semibold">{noshowTotal} disparos</span>
              )}
              <Button variant="outline" size="sm" onClick={fetchAntiNoshow} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {noshowData.map((d) => (
              <Card key={d.name}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-xs text-muted-foreground">{d.name}</span>
                  </div>
                  <p className="text-2xl font-bold">{d.quantidade}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">disparos</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {noshowTotal === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Os disparos aparecem aqui conforme a IA envia mensagens de confirmação de reunião
            </p>
          )}
        </TabsContent>

        {/* ── Remarketing ───────────────────────────────────────────────────── */}
        <TabsContent value="remarketing" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Reengajamento de leads que não fecharam</p>
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-xs">Em breve</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Repeat2,   label: 'Reengajados',      value: '—', color: '#8b5cf6' },
              { icon: Send,      label: 'Mensagens enviadas', value: '—', color: '#6d28d9' },
              { icon: Target,    label: 'Taxa de resposta',  value: '—', color: '#a78bfa' },
              { icon: BarChart3, label: 'Convertidos',       value: '—', color: '#4c1d95' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.label} className="opacity-60">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-muted-foreground">{item.value}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
            <Card className="max-w-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Limite de Disparos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Limite diário de mensagens</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={limits.limite_diario ?? ''}
                    onChange={(e) => setLimits((prev) => ({ ...prev, limite_diario: Number(e.target.value) }))}
                    className="h-10"
                    placeholder="Ex: 50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo de mensagens enviadas por dia pela IA
                  </p>
                </div>
                <Button onClick={handleSaveLimits} disabled={savingLimits} className="w-full gap-1.5">
                  <Save className="h-4 w-4" />
                  {savingLimits ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
