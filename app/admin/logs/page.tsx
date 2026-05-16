'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertCircle, AlertTriangle, Info, Zap,
  RefreshCw, Pause, Play, Search, ChevronDown, ChevronUp,
  Cpu, DollarSign, FlaskConical, Copy, Check, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)   return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function fmtFull(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ── Token Stats (compact) ─────────────────────────────────────────────────────

function TokenStats() {
  const [stats, setStats] = useState<{ monthly: { tokens: number; cost_usd: number }; all_time: { tokens: number; cost_usd: number } } | null>(null);
  useEffect(() => {
    fetch('/api/admin/tokens').then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); }).catch(() => {});
  }, []);
  if (!stats) return null;
  const brl = (usd: number) => `R$ ${(usd * 5.5).toFixed(2)}`;
  return (
    <div className="flex flex-wrap gap-4 text-sm">
      <span className="flex items-center gap-1.5 text-blue-400">
        <Cpu className="h-3.5 w-3.5" />
        <span className="font-semibold">{fmtTokens(stats.monthly.tokens)}</span>
        <span className="text-muted-foreground">tokens/mês</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-semibold">{brl(stats.monthly.cost_usd)}</span>
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <DollarSign className="h-3.5 w-3.5" />
        <span>Total: {fmtTokens(stats.all_time.tokens)} · {brl(stats.all_time.cost_usd)}</span>
      </span>
    </div>
  );
}

// ── Log Entry ─────────────────────────────────────────────────────────────────

type Log = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  payload?: any;
  created_at: string;
  company_id?: number;
};

const SEVERITY_CONFIG = {
  critical: { dot: 'bg-red-500',    text: 'text-red-400',    icon: AlertCircle,   label: 'Crítico'  },
  error:    { dot: 'bg-red-400',    text: 'text-red-400',    icon: AlertCircle,   label: 'Erro'     },
  warning:  { dot: 'bg-yellow-400', text: 'text-yellow-400', icon: AlertTriangle, label: 'Aviso'    },
  info:     { dot: 'bg-blue-400',   text: 'text-blue-400',   icon: Info,          label: 'Info'     },
};

function LogEntry({ log }: { log: Log }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = SEVERITY_CONFIG[log.severity] ?? SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  function copyEntry() {
    const text = JSON.stringify({ ...log, payload: log.payload }, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={cn(
      'group px-4 py-3 border-b border-border/40 transition-colors hover:bg-accent/30 last:border-0',
      log.severity === 'critical' && 'bg-red-500/5 border-l-2 border-l-red-500',
      log.severity === 'error' && 'border-l-2 border-l-red-400/60',
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wide', cfg.text)}>{cfg.label}</span>
            <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">{log.type}</span>
            {log.company_id && (
              <Link
                href={`/admin/empresas/${log.company_id}`}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                Empresa #{log.company_id}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            )}
            <span
              className="text-[10px] text-muted-foreground ml-auto cursor-default"
              title={fmtFull(log.created_at)}
            >
              {fmtRelative(log.created_at)}
            </span>
            <button
              onClick={copyEntry}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground ml-1"
              title="Copiar entry"
            >
              {copied
                ? <Check className="h-3 w-3 text-emerald-400" />
                : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <p className="text-sm text-foreground break-words leading-snug">{log.message}</p>
          {log.payload && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1.5 hover:text-foreground"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Ocultar payload' : 'Ver payload'}
            </button>
          )}
          {expanded && log.payload && (
            <pre className="mt-2 text-[11px] bg-muted/50 p-2 rounded overflow-x-auto border border-border font-mono leading-relaxed">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: 'Última hora',   value: '1h'       },
  { label: 'Hoje',          value: 'today'     },
  { label: 'Ontem',         value: 'yesterday' },
  { label: 'Última semana', value: 'week'      },
  { label: 'Último mês',    value: 'month'     },
];

function periodToDateRange(period: string) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  switch (period) {
    case '1h': {
      const h = new Date(now); h.setHours(h.getHours() - 1);
      return { from: h.toISOString(), to: now.toISOString() };
    }
    case 'today':
      return { from: `${todayStr}T00:00:00.000Z`, to: now.toISOString() };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const ys = y.toISOString().split('T')[0];
      return { from: `${ys}T00:00:00.000Z`, to: `${ys}T23:59:59.999Z` };
    }
    case 'week': {
      const w = new Date(now); w.setDate(w.getDate() - 7);
      return { from: w.toISOString(), to: now.toISOString() };
    }
    default: {
      const m = new Date(now); m.setDate(m.getDate() - 30);
      return { from: m.toISOString(), to: now.toISOString() };
    }
  }
}

export default function LogsDashboardPage() {
  const [logs, setLogs]           = useState<Log[]>([]);
  const [loading, setLoading]     = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [newCount, setNewCount]   = useState(0);
  const [period, setPeriod]       = useState('today');
  const [severity, setSeverity]   = useState('all');
  const [type, setType]           = useState('all');
  const [search, setSearch]       = useState('');
  const [tableMissing, setTableMissing] = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [testingLog, setTestingLog] = useState(false);
  const latestIdRef               = useRef<string | null>(null);

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setApiError(null);
    try {
      const { from, to } = periodToDateRange(period);
      const params = new URLSearchParams({ limit: '200', from_date: from, to_date: to });
      if (severity !== 'all') params.set('severity', severity);
      if (type !== 'all') params.set('type', type);

      const res = await fetch(`/api/admin/logs?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setApiError(err.message || `Erro HTTP ${res.status}`);
        return;
      }
      const data = await res.json();

      if (data.table_missing) {
        setTableMissing(true);
        setLogs([]);
        return;
      }
      setTableMissing(false);

      const newLogs: Log[] = data.data || [];

      if (isBackground && latestIdRef.current && newLogs.length > 0 && newLogs[0].id !== latestIdRef.current) {
        const idx = newLogs.findIndex(l => l.id === latestIdRef.current);
        setNewCount(idx >= 0 ? idx : newLogs.length);
      }

      if (newLogs.length > 0) latestIdRef.current = newLogs[0].id;
      setLogs(newLogs);
    } catch (err: any) {
      setApiError(err.message || 'Erro desconhecido ao carregar logs');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [period, severity, type]);

  async function sendTestLog() {
    setTestingLog(true);
    try {
      const res = await fetch('/api/admin/logs/test', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.table_missing) {
          setTableMissing(true);
          toast({
            title: 'Tabela system_logs não encontrada',
            description: 'Execute a migration 20260504000000_system_logs.sql no Supabase SQL Editor.',
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Erro ao escrever log de teste', description: data.error || 'Erro desconhecido', variant: 'destructive' });
        }
      } else {
        setTableMissing(false);
        await fetchLogs();
        toast({ title: 'Log de teste escrito', description: 'Tabela system_logs funcionando corretamente.' });
      }
    } finally {
      setTestingLog(false);
    }
  }

  useEffect(() => {
    setNewCount(0);
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    let remaining = 5;
    setCountdown(5);
    const tick = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        fetchLogs(true);
        remaining = 5;
        setCountdown(5);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [autoRefresh, fetchLogs]);

  const filtered = search.trim()
    ? logs.filter(l =>
        l.message.toLowerCase().includes(search.toLowerCase()) ||
        l.type.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.payload || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const errors   = filtered.filter(l => l.severity === 'error' || l.severity === 'critical').length;
  const warnings = filtered.filter(l => l.severity === 'warning').length;
  const sdrCount = filtered.filter(l => l.type?.toLowerCase().includes('sdr') || l.message?.toLowerCase().includes('sdr')).length;

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex-shrink-0 px-0 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Logs do Sistema</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Eventos em tempo real — agentes SDR, webhooks e erros</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {newCount > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary animate-pulse">
                +{newCount} novos
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => { setAutoRefresh(!autoRefresh); setNewCount(0); }} className="gap-1.5 h-8">
              {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoRefresh ? `${countdown}s` : 'Play'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setNewCount(0); fetchLogs(); }} className="gap-1.5 h-8">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={sendTestLog} disabled={testingLog} className="gap-1.5 h-8" title="Escreve um log de teste para verificar se a tabela existe">
              {testingLog ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              Testar
            </Button>
          </div>
        </div>

        {/* Token stats compact */}
        <TokenStats />

        {/* Stats chips */}
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="text-muted-foreground">{filtered.length} logs</span>
          {errors > 0 && (
            <span className="flex items-center gap-1 text-red-400 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />{errors} erro{errors !== 1 ? 's' : ''}
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-1 text-yellow-400 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />{warnings} aviso{warnings !== 1 ? 's' : ''}
            </span>
          )}
          {sdrCount > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              <Zap className="h-3.5 w-3.5" />{sdrCount} SDR
            </span>
          )}
        </div>

        {/* Diagnóstico: tabela ausente */}
        {tableMissing && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">Tabela <code className="font-mono">system_logs</code> não encontrada.</span>
              {' '}Execute a migration{' '}
              <code className="font-mono text-[11px] bg-muted/40 px-1 rounded">20260504000000_system_logs.sql</code>
              {' '}no Supabase SQL Editor.
            </div>
          </div>
        )}

        {apiError && !tableMissing && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 text-sm">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div><span className="font-semibold">Erro ao carregar logs:</span> <code className="font-mono text-[11px]">{apiError}</code></div>
          </div>
        )}

        {/* Filter toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={period} onValueChange={(v) => { setPeriod(v); setNewCount(0); }}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={severity} onValueChange={(v) => { setSeverity(v); setNewCount(0); }}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Severidade</SelectItem>
              <SelectItem value="info" className="text-xs">Info</SelectItem>
              <SelectItem value="warning" className="text-xs">Aviso</SelectItem>
              <SelectItem value="error" className="text-xs">Erro</SelectItem>
              <SelectItem value="critical" className="text-xs">Crítico</SelectItem>
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={(v) => { setType(v); setNewCount(0); }}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Tipo</SelectItem>
              <SelectItem value="sdr" className="text-xs">SDR</SelectItem>
              <SelectItem value="follow_up" className="text-xs">Follow-up</SelectItem>
              <SelectItem value="billing" className="text-xs">Billing</SelectItem>
              <SelectItem value="webhook" className="text-xs">Webhook</SelectItem>
              <SelectItem value="error" className="text-xs">Error</SelectItem>
              <SelectItem value="system" className="text-xs">Sistema</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar mensagem, tipo, payload..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Log list — fills remaining height */}
      <div className="flex-1 min-h-0 border border-border/50 rounded-lg overflow-hidden flex flex-col bg-card">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Carregando logs...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center p-8">
            <Info className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-medium">Nenhum log no período selecionado</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Logs aparecem quando o agente SDR processa mensagens, follow-up roda, ou ocorrem erros.
              Use <strong>Testar</strong> para verificar se a tabela está configurada.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-minimal">
            {filtered.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
