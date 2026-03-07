'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

const salesColors   = ['#1a0c2e', '#30184C', '#462068', '#5c2d84', '#7240a0', '#8855bb'];
const outboundColors = ['#4c1d95', '#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa'];
const noshowColors   = ['#4c1d95', '#6d28d9', '#8b5cf6', '#a78bfa'];

// Estágios Anti Noshow em ordem fixa — chaves flexíveis para casar com valores do DB
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

export function SalesFunnelTabs({ stages, outboundStages, antiNoshowCounts }: SalesFunnelTabsProps) {
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
      <Card className="h-full flex flex-col">
        <CardContent className="flex-1 pt-6">
          <Tabs defaultValue="vendas" className="h-full flex flex-col">
            <TabsList className="mb-4 self-start">
              <TabsTrigger value="vendas">Funil de Vendas</TabsTrigger>
              <TabsTrigger value="outbound">Funil Outbound</TabsTrigger>
              <TabsTrigger value="noshow">Anti Noshow</TabsTrigger>
              <TabsTrigger value="remarketing">Remarketing</TabsTrigger>
            </TabsList>

            <TabsContent value="vendas">
              <FunnelBarChart data={salesData} />
            </TabsContent>

            <TabsContent value="outbound">
              <FunnelBarChart data={outboundData} />
            </TabsContent>

            <TabsContent value="noshow">
              <FunnelBarChart data={noshowData} />
            </TabsContent>

            <TabsContent value="remarketing" className="flex flex-col items-center justify-center h-[340px] gap-3">
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
