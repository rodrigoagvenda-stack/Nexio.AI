'use client';

import { Bar, BarChart, CartesianGrid, XAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
} from '@/components/ui/chart';
import { motion } from 'framer-motion';

interface PerformanceData {
  name: string;
  leads: number;
  fechados: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
}

const chartConfig = {
  leads: {
    label: 'Leads gerados',
    color: '#30184C',
  },
  fechados: {
    label: 'Leads fechados',
    color: '#191919',
  },
} satisfies ChartConfig;

const legendItems = [
  { label: 'Leads gerados', color: '#30184C' },
  { label: 'Leads fechados', color: '#191919' },
];

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Performance de Vendas</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col pb-4">
          <ChartContainer config={chartConfig} className="flex-1 min-h-[160px] w-full">
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  color: 'hsl(var(--popover-foreground))',
                }}
                itemStyle={{
                  color: 'hsl(var(--popover-foreground))',
                }}
                formatter={(value: number, name: string) => {
                  const label = name === 'leads' ? 'Leads gerados' : 'Leads fechados';
                  return [value, label];
                }}
              />
              <Bar
                dataKey="leads"
                fill="var(--color-leads)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="fechados"
                fill="var(--color-fechados)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
          {/* Legend with circles - matching ConversionDonut style */}
          <div className="mt-6 flex justify-center gap-6">
            {legendItems.map((item, index) => (
              <motion.div
                key={index}
                className="flex items-center gap-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-foreground">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
