'use client';

import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';

interface PerformanceData {
  name: string;
  leads: number;
  fechados: number;
}

interface PerformanceChartProps {
  data: PerformanceData[];
}

const COLORS = { leads: '#15803d', fechados: '#2A2A2A' };

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardHeader className="flex-shrink-0 pb-3">
          <CardTitle className="text-base font-semibold">Performance de vendas</CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col pb-4 px-2">
          <div className="flex-1 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barCategoryGap="30%" barGap={3}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tick={{ fill: '#666', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{
                    backgroundColor: '#161616',
                    border: '1px solid #252525',
                    borderRadius: 8,
                    color: '#D8D8D8',
                    fontSize: 12,
                  }}
                  itemStyle={{ color: '#D8D8D8' }}
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'leads' ? 'Leads gerados' : 'Leads fechados',
                  ]}
                />
                <Bar dataKey="leads" fill={COLORS.leads} radius={[4, 4, 0, 0]} />
                <Bar dataKey="fechados" fill={COLORS.fechados} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* legenda embaixo do gráfico */}
          <div className="flex justify-center gap-6 pt-3">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#888' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS.leads }} />
              Leads gerados
            </span>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: '#888' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#4A4A4A' }} />
              Leads fechados
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
