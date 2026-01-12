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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage, i) => {
            const percentage = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;

            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{stage.label}</span>
                  <span className="text-muted-foreground">
                    {stage.count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 bg-accent/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
