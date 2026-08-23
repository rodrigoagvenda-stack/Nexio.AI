'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelStage {
  key: string;
  label: string;
  count: number;
  cost_per_unit_cents: number | null;
}

interface FunnelResponse {
  stages: FunnelStage[];
  note?: string;
}

interface MessageFunnelCardProps {
  since?: Date;
  until?: Date;
}

function formatCurrency(cents: number | null): string {
  if (cents === null) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function MessageFunnelCard({ since, until }: MessageFunnelCardProps) {
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!since || !until) return;
    setLoading(true);
    const params = new URLSearchParams({ since: toISODate(since), until: toISODate(until) });
    fetch(`/api/reports/message-funnel?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [since, until]);

  const stages = data?.stages ?? [];
  const maxCount = Math.max(1, ...stages.map(s => s.count));
  const hasData = stages.some(s => s.count > 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary/70" />
          Funil de Mensagens
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/25" />
            <p className="text-sm text-muted-foreground">
              {data?.note ?? 'Sem dados de campanha sincronizados ainda.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage, i) => {
              const prevCount = i > 0 ? stages[i - 1].count : stage.count;
              const rate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : null;
              const width = Math.max(6, Math.round((stage.count / maxCount) * 100));
              return (
                <div key={stage.key}>
                  <div className="flex items-baseline justify-between text-xs mb-1">
                    <span className="font-medium text-foreground/90">{stage.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {stage.count.toLocaleString('pt-BR')}
                      {i > 0 && rate !== null && <span className="ml-1.5">({rate}%)</span>}
                      {stage.cost_per_unit_cents !== null && (
                        <span className="ml-1.5 text-muted-foreground/60">· {formatCurrency(stage.cost_per_unit_cents)}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full bg-primary transition-all', i > 0 && 'opacity-90')}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
