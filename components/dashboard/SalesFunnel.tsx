'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
  // Gradiente de cores do roxo escuro (Fechado) ao lilás claro (Lead novo)
  const colors = [
    '#1a0c2e', // roxo Nexio muito escuro - Fechado
    '#30184C', // roxo Nexio - primário
    '#462068', // roxo Nexio médio
    '#5c2d84', // roxo Nexio médio claro
    '#7240a0', // roxo Nexio claro
    '#8855bb', // roxo Nexio mais claro - Lead novo
  ];

  // Validação: garantir que stages é um array válido
  const validStages = Array.isArray(stages) ? stages : [];

  // Preparar dados para o gráfico de barras - cada estágio com sua cor
  const chartData = validStages.map((stage, index) => ({
    name: stage.label,
    quantidade: stage.count,
    fill: colors[index % colors.length],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Funil de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                labelStyle={{
                  color: 'hsl(var(--primary))',
                  fontWeight: 600,
                }}
                itemStyle={{
                  color: 'hsl(var(--primary))',
                }}
                cursor={{ fill: 'hsl(var(--accent))' }}
              />
              <Bar
                dataKey="quantidade"
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </motion.div>
  );
}
