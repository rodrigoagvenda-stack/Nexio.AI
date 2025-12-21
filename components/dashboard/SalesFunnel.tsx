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
        <div className="space-y-4">
          {stages.map((stage, i) => {
            const percentage = totalLeads > 0 ? (stage.count / totalLeads) * 100 : 0;

            return (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{stage.label}</span>
                  <span className="text-muted-foreground">
                    {stage.count} leads ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
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
