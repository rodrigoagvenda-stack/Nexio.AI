'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface FunnelStage {
  label: string;
  count: number;
  color?: string;
}

interface SalesFunnelProps {
  stages: FunnelStage[];
  totalLeads: number;
}

export function SalesFunnel({ stages, totalLeads }: SalesFunnelProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  const getStageColor = (index: number) => {
    const colors = [
      'bg-blue-500',
      'bg-pink-500',
      'bg-purple-500',
      'bg-cyan-500',
      'bg-zinc-700',
      'bg-red-500',
    ];
    return colors[index] || 'bg-primary';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 py-4">
          {stages.map((stage, i) => {
            const percentage = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;
            const widthPercentage = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground">{stage.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {stage.count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="relative h-10 bg-accent/50 rounded-lg overflow-hidden">
                      <motion.div
                        className={`absolute left-0 top-0 h-full ${getStageColor(i)} flex items-center justify-start px-3`}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPercentage}%` }}
                        transition={{ duration: 0.8, delay: i * 0.15, ease: 'easeOut' }}
                        style={{
                          minWidth: stage.count > 0 ? '40px' : '0px',
                        }}
                      >
                        <span className="text-xs font-semibold text-white">
                          {stage.count > 0 ? stage.count : ''}
                        </span>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
