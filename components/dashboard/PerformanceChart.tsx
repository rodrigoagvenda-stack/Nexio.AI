'use client';

import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
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
    label: 'Leads',
    color: '#30184C',
  },
  fechados: {
    label: 'Fechados',
    color: '#191919',
  },
} satisfies ChartConfig;

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
        <CardContent className="flex-1 pb-4">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
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
        </CardContent>
      </Card>
    </motion.div>
  );
}
