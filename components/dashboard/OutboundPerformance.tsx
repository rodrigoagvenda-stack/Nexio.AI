'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Bot, ArrowRight, Users, MessageCircle, CalendarCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface OutboundPerformanceProps {
  abordados: number;
  retornaram: number;
  reuniao: number;
  fechados: number;
  followups: number;
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export function OutboundPerformance({
  abordados,
  retornaram,
  reuniao,
  fechados,
  followups,
}: OutboundPerformanceProps) {
  const taxaRetorno = pct(retornaram, abordados);
  const taxaReuniao = pct(reuniao, retornaram);
  const taxaFechamento = pct(fechados, reuniao > 0 ? reuniao : retornaram);
  const taxaGeral = pct(fechados, abordados);
  const maxVal = Math.max(abordados, 1);

  const steps = [
    { label: 'Abordados',       value: abordados,  icon: Users,         badge: null,                barColor: 'bg-violet-500' },
    { label: 'Retornaram',      value: retornaram, icon: MessageCircle, badge: `${taxaRetorno}%`,   barColor: 'bg-violet-400' },
    { label: 'Reunião / Conv.', value: reuniao,    icon: CalendarCheck, badge: `${taxaReuniao}%`,   barColor: 'bg-emerald-500' },
    { label: 'Fechados',        value: fechados,   icon: CheckCircle2,  badge: `${taxaFechamento}%`, barColor: 'bg-emerald-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Card>
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Bot className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="font-semibold leading-tight">IA Outbound</p>
                <p className="text-xs text-muted-foreground">Performance do agente automático</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Followups feitos</p>
                <p className="text-2xl font-bold">{followups}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Taxa geral</p>
                <p
                  className={`text-2xl font-bold ${
                    taxaGeral >= 10
                      ? 'text-emerald-500'
                      : taxaGeral >= 5
                        ? 'text-amber-500'
                        : 'text-muted-foreground'
                  }`}
                >
                  {taxaGeral}%
                </p>
              </div>
            </div>
          </div>

          {/* Funnel cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {steps.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = step.value > 0;
              return (
                <div key={step.label} className="relative">
                  {i > 0 && (
                    <div className="absolute -left-[10px] top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl border p-4 text-center space-y-2 transition-colors ${
                      isActive ? 'border-violet-500/30 bg-violet-500/5' : 'border-border bg-muted/20'
                    }`}
                  >
                    <div className="flex justify-center">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          isActive ? 'bg-violet-500/15' : 'bg-muted'
                        }`}
                      >
                        <StepIcon
                          className={`h-4 w-4 ${isActive ? 'text-violet-500' : 'text-muted-foreground'}`}
                        />
                      </div>
                    </div>
                    <p className="text-2xl font-bold leading-none">{step.value}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{step.label}</p>
                    {step.badge !== null && (
                      <span
                        className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {step.badge}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bars */}
          <div className="space-y-2">
            {steps.map((step, i) => {
              const width = Math.round((step.value / maxVal) * 100);
              return (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0 text-right">
                    {step.label}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${step.barColor}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                    />
                  </div>
                  <span className="text-xs font-medium w-6 text-right tabular-nums">
                    {step.value}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
