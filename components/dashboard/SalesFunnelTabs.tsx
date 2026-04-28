'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';

interface FunnelStage {
  label: string;
  count: number;
}

interface SalesFunnelTabsProps {
  stages: FunnelStage[];
  outboundStages: FunnelStage[];
  antiNoshowCounts: Record<string, number>;
}

const salesColors   = ['#052e16', '#15803d', '#166534', '#16a34a', '#22c55e', '#4ade80'];
const outboundColors = ['#14532d', '#15803d', '#16a34a', '#22c55e', '#4ade80'];
const noshowColors   = ['#14532d', '#15803d', '#16a34a', '#22c55e'];

const NOSHOW_STAGES = [
  { label: '24h antes',   keys: ['24h', '24h_antes',  'antecipacao', '24'] },
  { label: '2h antes',    keys: ['2h',  '2h_antes',   'reforco']          },
  { label: '15min antes', keys: ['15min','15min_antes','15']               },
  { label: '5min após',   keys: ['5min','5min_apos',  '5min_após','resgate','5'] },
];

function resolveNoshowCount(counts: Record<string, number>, keys: string[]): number {
  for (const [k, v] of Object.entries(counts)) {
    if (keys.some(key => k.toLowerCase().includes(key.toLowerCase()))) return v;
  }
  return 0;
}

function FunnelBarChart({ data, isMobile }: { data: { name: string; quantidade: number; fill: string }[]; isMobile: boolean }) {
  return (
    <div className="h-[200px] md:h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={isMobile
            ? { top: 4, right: 12, left: 0, bottom: 4 }
            : { top: 10, right: 30, left: 10, bottom: 5 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            fontSize={isMobile ? 10 : 12}
            tickLine={false}
            axisLine={false}
          />
          {!isMobile && (
            <YAxis
              type="category"
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={145}
            />
          )}
          {isMobile && (
            <YAxis
              type="category"
              dataKey="name"
              hide
              width={0}
            />
          )}
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: 12 }}
            labelStyle={{ color: 'hsl(var(--primary))', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(var(--primary))' }}
            cursor={{ fill: 'hsl(var(--accent))' }}
          />
          <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} animationDuration={900} minPointSize={isMobile ? 32 : 0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            {isMobile && (
              <LabelList
                dataKey="name"
                position="insideLeft"
                style={{ fill: '#fff', fontSize: 10, fontWeight: 600 }}
                formatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesFunnelTabs({ stages, outboundStages, antiNoshowCounts }: SalesFunnelTabsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const salesData = stages.map((s, i) => ({
    name: s.label, quantidade: s.count, fill: salesColors[i % salesColors.length],
  }));

  const outboundData = outboundStages.map((s, i) => ({
    name: s.label, quantidade: s.count, fill: outboundColors[i % outboundColors.length],
  }));

  const noshowData = NOSHOW_STAGES.map((s, i) => ({
    name: s.label,
    quantidade: resolveNoshowCount(antiNoshowCounts, s.keys),
    fill: noshowColors[i],
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full"
    >
      <Card className="h-full flex flex-col overflow-hidden">
        <CardContent className="flex-1 pt-4 md:pt-6 px-3 md:px-6">
          <Tabs defaultValue="vendas" className="h-full flex flex-col">
            <TabsList
              className="mb-3 flex w-full overflow-x-auto flex-nowrap sm:flex-wrap sm:w-auto h-auto gap-0.5 !justify-start"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <TabsTrigger value="vendas" className="flex-shrink-0 text-xs md:text-sm">Funil de Vendas</TabsTrigger>
              <TabsTrigger value="outbound" className="flex-shrink-0 text-xs md:text-sm">Funil Outbound</TabsTrigger>
              <TabsTrigger value="noshow" className="flex-shrink-0 text-xs md:text-sm">Anti Noshow</TabsTrigger>
              <TabsTrigger value="remarketing" className="flex-shrink-0 text-xs md:text-sm">Remarketing</TabsTrigger>
            </TabsList>

            <TabsContent value="vendas">
              <FunnelBarChart data={salesData} isMobile={isMobile} />
            </TabsContent>

            <TabsContent value="outbound">
              <FunnelBarChart data={outboundData} isMobile={isMobile} />
            </TabsContent>

            <TabsContent value="noshow">
              <FunnelBarChart data={noshowData} isMobile={isMobile} />
            </TabsContent>

            <TabsContent value="remarketing" className="flex flex-col items-center justify-center h-[200px] md:h-[290px] gap-3">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Remarketing em breve</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs text-center">
                As métricas de Remarketing serão configuradas em breve.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
