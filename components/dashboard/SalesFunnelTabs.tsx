'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Sector } from 'recharts';
import { motion } from 'framer-motion';

interface FunnelStage {
  label: string;
  count: number;
}

interface SalesFunnelTabsProps {
  stages: FunnelStage[];
  outboundStages: FunnelStage[];
  followupsTotal: number;
  followupsResponded: number;
}

const salesColors  = ['#1a0c2e', '#30184C', '#462068', '#5c2d84', '#7240a0', '#8855bb'];
const outboundColors = ['#4c1d95', '#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa'];

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

function FunnelBarChart({ data }: { data: { name: string; quantidade: number; fill: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12}
          tickLine={false} axisLine={false} width={145} />
        <Tooltip
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
          labelStyle={{ color: 'hsl(var(--primary))', fontWeight: 600 }}
          itemStyle={{ color: 'hsl(var(--primary))' }}
          cursor={{ fill: 'hsl(var(--accent))' }}
        />
        <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} animationDuration={900}>
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SalesFunnelTabs({ stages, outboundStages, followupsTotal, followupsResponded }: SalesFunnelTabsProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const salesData = stages.map((s, i) => ({
    name: s.label, quantidade: s.count, fill: salesColors[i % salesColors.length],
  }));

  const outboundData = outboundStages.map((s, i) => ({
    name: s.label, quantidade: s.count, fill: outboundColors[i % outboundColors.length],
  }));

  const safeTotal = Math.max(followupsTotal, 1);
  const responseRate = Math.round((followupsResponded / safeTotal) * 100);
  const donutData = [
    { name: 'Followups feitos',  value: followupsTotal,     color: '#7c3aed' },
    { name: 'Taxa de resposta',  value: followupsResponded, color: 'hsl(var(--chart-2))' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full"
    >
      <Card className="h-full flex flex-col">
        <CardContent className="flex-1 pt-6">
          <Tabs defaultValue="vendas" className="h-full flex flex-col">
            <TabsList className="mb-4 self-start">
              <TabsTrigger value="vendas">Funil de Vendas</TabsTrigger>
              <TabsTrigger value="outbound">Funil Outbound</TabsTrigger>
              <TabsTrigger value="followups">Followups</TabsTrigger>
            </TabsList>

            <TabsContent value="vendas">
              <FunnelBarChart data={salesData} />
            </TabsContent>

            <TabsContent value="outbound">
              <FunnelBarChart data={outboundData} />
            </TabsContent>

            <TabsContent value="followups" className="flex flex-col items-center justify-center">
              <div className="relative w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      data={donutData}
                      cx="50%" cy="50%"
                      innerRadius="52%" outerRadius="82%"
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                      animationDuration={1000}
                      animationBegin={300}
                      onMouseEnter={(_, i) => setActiveIndex(i)}
                      onMouseLeave={() => setActiveIndex(undefined)}
                      style={{ cursor: 'pointer' }}
                    >
                      {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '6px', color: 'hsl(var(--popover-foreground))' }}
                      itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <motion.div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                >
                  <div className="text-center">
                    <div className="text-4xl lg:text-5xl font-bold text-foreground">{responseRate}%</div>
                    <div className="text-xs text-muted-foreground mt-1">Taxa de resposta</div>
                  </div>
                </motion.div>
              </div>

              <div className="mt-6 flex justify-center gap-6">
                {donutData.map((entry, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-sm text-foreground">{entry.name}</span>
                  </motion.div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
