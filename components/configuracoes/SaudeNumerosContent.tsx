'use client';

import { useState, useEffect } from 'react';
import { Loader2, Wifi, AlertTriangle, CheckCircle2, TrendingUp, MessageSquare, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NumberHealth {
  id: string;
  friendly_name: string;
  phone_number: string;
  status: string;
  conversations_30d: number;
  metrics: {
    quality_rating: string | null;
    current_tier: string | null;
    tier_limit: number | null;
    response_rate_msg1: number | null;
    response_rate_msg2: number | null;
    response_rate_msg3: number | null;
    volume_sent_24h: number | null;
    volume_received_24h: number | null;
    measured_at: string | null;
  } | null;
}

const RATING_CONFIG = {
  green:  { label: 'Ótima', color: 'text-emerald-400', bg: 'bg-emerald-400' },
  yellow: { label: 'Atenção', color: 'text-amber-400', bg: 'bg-amber-400' },
  red:    { label: 'Crítica', color: 'text-red-400', bg: 'bg-red-400' },
};

export function SaudeNumerosContent() {
  const [numbers, setNumbers] = useState<NumberHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationPending, setMigrationPending] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/number-health');
      const d = await res.json();
      if (d.migration_pending) { setMigrationPending(true); return; }
      setNumbers(d.numbers ?? []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (migrationPending) return (
    <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center space-y-2">
      <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto" />
      <p className="text-sm font-medium">Migration pendente</p>
      <p className="text-xs text-muted-foreground">Execute a migration no Supabase para habilitar o painel de saúde.</p>
    </div>
  );

  if (numbers.length === 0) return (
    <div className="p-8 rounded-2xl border border-dashed border-border text-center space-y-2">
      <Wifi className="h-8 w-8 text-muted-foreground mx-auto" />
      <p className="text-sm font-medium">Nenhum número conectado</p>
      <p className="text-xs text-muted-foreground">Conecte um número na aba Números WA para ver o painel de saúde.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Monitoramento de qualidade e volume por número WhatsApp</p>
        <Button variant="ghost" size="sm" onClick={fetch_} disabled={loading}>
          <RefreshCcw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {numbers.map(num => {
        const m = num.metrics;
        const rating = m?.quality_rating as keyof typeof RATING_CONFIG | null;
        const rc = rating ? RATING_CONFIG[rating] ?? RATING_CONFIG.green : null;

        return (
          <div key={num.id} className="p-5 rounded-2xl border border-border bg-card space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{num.friendly_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{num.phone_number}</p>
              </div>
              {rc ? (
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', rc.bg)} />
                  <span className={cn('text-xs font-semibold', rc.color)}>{rc.label}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Sem dados</span>
              )}
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Conversas 30d</p>
                <p className="text-lg font-bold tabular-nums">{num.conversations_30d}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tier</p>
                <p className="text-lg font-bold">{m?.current_tier ?? 'N/A'}</p>
                {m?.tier_limit && <p className="text-[10px] text-muted-foreground">Limite: {m.tier_limit}/24h</p>}
              </div>
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Enviadas 24h</p>
                <p className="text-lg font-bold tabular-nums">{m?.volume_sent_24h ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Recebidas 24h</p>
                <p className="text-lg font-bold tabular-nums">{m?.volume_received_24h ?? 0}</p>
              </div>
            </div>

            {/* Response rate by message position */}
            {(m?.response_rate_msg1 || m?.response_rate_msg2 || m?.response_rate_msg3) && (
              <div>
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Taxa de resposta por posição da mensagem
                </p>
                <div className="space-y-2">
                  {[
                    { label: '1ª mensagem', value: m?.response_rate_msg1 },
                    { label: '2ª mensagem', value: m?.response_rate_msg2 },
                    { label: '3ª mensagem', value: m?.response_rate_msg3 },
                  ].filter(r => r.value != null).map(r => (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24 shrink-0">{r.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(r.value!, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums w-10 text-right">{r.value?.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {m?.measured_at && (
              <p className="text-[10px] text-muted-foreground/60">
                Última atualização: {new Date(m.measured_at).toLocaleString('pt-BR')}
              </p>
            )}

            {!m && (
              <div className="p-3 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground text-center">
                Sem dados de saúde ainda. Os dados são coletados automaticamente a partir do Meta API.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
