'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '@/lib/utils/format';
import {
  AlertCircle, AlertTriangle, Info, Zap,
  RefreshCw, Pause, Play, Search, ChevronDown, ChevronUp, Cpu, DollarSign,
} from 'lucide-react';

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function TokenStats() {
  const [stats, setStats] = useState<{ monthly: { tokens: number; cost_usd: number }; all_time: { tokens: number; cost_usd: number } } | null>(null);
  useEffect(() => {
    fetch('/api/admin/tokens').then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); }).catch(() => {});
  }, []);
  if (!stats) return null;
  const brl = (usd: number) => `R$ ${(usd * 5.5).toFixed(2)}`;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Cpu className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Tokens este mês</p>
            <p className="text-xl font-bold text-blue-400 mt-0.5">{fmtTokens(stats.monthly.tokens)}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <DollarSign className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Custo este mês</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{brl(stats.monthly.cost_usd)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <Cpu className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Tokens total</p>
            <p className="text-xl font-bold mt-0.5">{fmtTokens(stats.all_time.tokens)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Custo total</p>
            <p className="text-xl font-bold mt-0.5">{brl(stats.all_time.cost_usd)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type Log = {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  payload?: any;
  created_at: string;
  company_id?: number;
};

const PERIOD_OPTIONS = [
  { label: 'Última hora',   value: '1h'  },
  { label: 'Hoje',          value: 'today' },
  { label: 'Ontem',         value: 'yesterday' },
  { label: 'Última Semana', value: 'week' },
  { label: 'Último Mês',    value: 'month' },
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

const SEVERITY_CONFIG = {
  critical: { color: 'bg-red-600',    text: 'text-red-400',    icon: AlertCircle,   label: 'Crítico'  },
  error:    { color: 'bg-red-500',    text: 'text-red-400',    icon: AlertCircle,   label: 'Erro'     },
  warning:  { color: 'bg-yellow-500', text: 'text-yellow-400', icon: AlertTriangle, label: 'Aviso'    },
  info:     { color: 'bg-blue-500',   text: 'text-blue-400',   icon: Info,          label: 'Info'     },
};

function LogEntry({ log }: { log: Log }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div className={`border rounded-lg p-3 transition-colors hover:bg-accent/30 ${
      log.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
      log.severity === 'error'    ? 'border-red-400/20' :
      log.severity === 'warning'  ? 'border-yellow-500/20' : 'border-border'
    }`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${cfg.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={`${cfg.color} text-white text-[10px] px-1.5 py-0`}>{cfg.label}</Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{log.type}</Badge>
            {log.company_id && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Empresa #{log.company_id}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{formatDateTime(log.created_at)}</span>
          </div>
          <p className="text-sm text-foreground break-words">{log.message}</p>
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
            <pre className="mt-2 text-[11px] bg-muted/50 p-2 rounded overflow-x-auto max-h-48 border border-border">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
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
  const latestIdRef               = useRef<string | null>(null);

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const { from, to } = periodToDateRange(period);
      const params = new URLSearchParams({ limit: '200', from_date: from, to_date: to });
      if (severity !== 'all') params.set('severity', severity);
      if (type !== 'all') params.set('type', type);

      const res = await fetch(`/api/admin/logs?${params}`);
      const data = await res.json();
      const newLogs: Log[] = data.data || [];

      if (isBackground && latestIdRef.current && newLogs.length > 0 && newLogs[0].id !== latestIdRef.current) {
        const idx = newLogs.findIndex(l => l.id === latestIdRef.current);
        setNewCount(idx >= 0 ? idx : newLogs.length);
      }

      if (newLogs.length > 0) latestIdRef.current = newLogs[0].id;
      setLogs(newLogs);
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [period, severity, type]);

  // Fetch on filter change
  useEffect(() => {
    setNewCount(0);
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh polling
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

  // Client-side text search
  const filtered = search.trim()
    ? logs.filter(l =>
        l.message.toLowerCase().includes(search.toLowerCase()) ||
        l.type.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.payload || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  const stats = {
    total:    filtered.length,
    errors:   filtered.filter(l => l.severity === 'error' || l.severity === 'critical').length,
    warnings: filtered.filter(l => l.severity === 'warning').length,
    sdr:      filtered.filter(l => l.type?.toLowerCase().includes('sdr') || l.message?.toLowerCase().includes('sdr')).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Logs do Sistema</h1>
          <p className="text-muted-foreground mt-1 text-sm">Eventos em tempo real — agentes SDR, requisições e erros</p>
        </div>
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <Badge className="bg-primary text-primary-foreground animate-pulse">
              +{newCount} novos
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAutoRefresh(!autoRefresh); setNewCount(0); }}
            className="gap-2"
          >
            {autoRefresh ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoRefresh ? `Pausar (${countdown}s)` : 'Retomar'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNewCount(0); fetchLogs(); }} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Token stats globais */}
      <TokenStats />

      {/* Stats de logs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className={stats.errors > 0 ? 'border-red-500/30 bg-red-500/5' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Erros</p>
            <p className={`text-2xl font-bold mt-1 ${stats.errors > 0 ? 'text-red-400' : ''}`}>{stats.errors}</p>
          </CardContent>
        </Card>
        <Card className={stats.warnings > 0 ? 'border-yellow-500/20' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avisos</p>
            <p className={`text-2xl font-bold mt-1 ${stats.warnings > 0 ? 'text-yellow-400' : ''}`}>{stats.warnings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" /> SDR
            </p>
            <p className="text-2xl font-bold mt-1">{stats.sdr}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={period} onValueChange={(v) => { setPeriod(v); setNewCount(0); }}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severity} onValueChange={(v) => { setSeverity(v); setNewCount(0); }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas severidades</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={type} onValueChange={(v) => { setType(v); setNewCount(0); }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="sdr">SDR</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="user_action">User Action</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar mensagem, tipo, payload..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Carregando logs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Info className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum log encontrado para os filtros selecionados</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
