'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunnelStage {
  label: string;
  count: number;
}

interface SalesFunnelTabsProps {
  stages: FunnelStage[];
  antiNoshowCounts: Record<string, number>;
}

const salesColors  = ['#052e16', '#15803d', '#166534', '#16a34a', '#22c55e', '#4ade80'];
const noshowColors = ['#14532d', '#15803d', '#16a34a', '#22c55e'];

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

type TabValue = 'vendas' | 'noshow' | 'remarketing';

const TAB_LABELS: Record<TabValue, string> = {
  vendas: 'Funil de Vendas',
  noshow: 'Anti Noshow',
  remarketing: 'Remarketing',
};

export function SalesFunnelTabs({ stages, antiNoshowCounts }: SalesFunnelTabsProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>('vendas');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const salesData = stages.map((s, i) => ({
    name: s.label, quantidade: s.count, fill: salesColors[i % salesColors.length],
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
        <CardContent className="flex-1 pt-4 md:pt-6 px-3 md:px-6 flex flex-col">
          <div className="mb-3">
            <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
              {(Object.keys(TAB_LABELS) as TabValue[]).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap',
                    activeTab === t
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            {activeTab === 'vendas' && <FunnelBarChart data={salesData} isMobile={isMobile} />}
            {activeTab === 'noshow' && <FunnelBarChart data={noshowData} isMobile={isMobile} />}
            {activeTab === 'remarketing' && (
              <div className="flex flex-col items-center justify-center h-[200px] md:h-[290px] gap-3">
                <Bell className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Remarketing em breve</p>
                <p className="text-xs text-muted-foreground/60 max-w-xs text-center">
                  As métricas de Remarketing serão configuradas em breve.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
