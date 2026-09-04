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
  group: 'funil' | 'profundidade';
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
  const funilStages = stages.filter(s => s.group === 'funil');
  const profundidadeStages = stages.filter(s => s.group === 'profundidade');
  const funilMax = Math.max(1, ...funilStages.map(s => s.count));
  const profundidadeMax = Math.max(1, ...profundidadeStages.map(s => s.count));
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
          <div className="space-y-5">
            {funilStages.length > 0 && (
              <div className="space-y-3">
                {funilStages.map((stage, i) => {
                  const prevCount = i > 0 ? funilStages[i - 1].count : stage.count;
                  const rate = prevCount > 0 ? Math.round((stage.count / prevCount) * 100) : null;
                  const width = Math.max(6, Math.round((stage.count / funilMax) * 100));
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
            {profundidadeStages.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted-foreground/70">
                  Volume de mensagens por profundidade da conversa (não é contagem de pessoas restantes, pode variar sem relação direta com o funil acima)
                </p>
                {profundidadeStages.map((stage) => {
                  const width = Math.max(6, Math.round((stage.count / profundidadeMax) * 100));
                  return (
                    <div key={stage.key}>
                      <div className="flex items-baseline justify-between text-xs mb-1">
                        <span className="font-medium text-foreground/90">{stage.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {stage.count.toLocaleString('pt-BR')}
                          {stage.cost_per_unit_cents !== null && (
                            <span className="ml-1.5 text-muted-foreground/60">· {formatCurrency(stage.cost_per_unit_cents)}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
