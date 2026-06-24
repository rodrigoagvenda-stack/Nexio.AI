'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Bell, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface FunnelStage {
  label: string;
  count: number;
}

interface SalesFunnelTabsProps {
  stages: FunnelStage[];
  antiNoshowCounts: Record<string, number>;
  remarketingCount?: number;
}

const NOSHOW_STAGES = [
  { label: '24h antes',   keys: ['24h', '24h_antes', 'antecipacao', '24'] },
  { label: '2h antes',    keys: ['2h', '2h_antes', 'reforco'] },
  { label: '15min antes', keys: ['15min', '15min_antes', '15'] },
  { label: '5min após',   keys: ['5min', '5min_apos', '5min_após', 'resgate', '5'] },
];

function resolveNoshowCount(counts: Record<string, number>, keys: string[]): number {
  for (const [k, v] of Object.entries(counts)) {
    if (keys.some(key => k.toLowerCase().includes(key.toLowerCase()))) return v;
  }
  return 0;
}

const chartConfig = {
  quantidade: {
    label: 'Leads',
    color: '#01573C',
  },
} satisfies ChartConfig;

function getInitials(label: string): string {
  return label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
}

function MobileBarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-1.5 shadow-xl text-xs font-medium">
      <p className="text-foreground">{payload[0]?.payload?.fullName}</p>
      <p className="text-primary">{payload[0]?.value} lead{payload[0]?.value !== 1 ? 's' : ''}</p>
    </div>
  );
}

function HorizontalBars({ data }: { data: { name: string; quantidade: number }[] }) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    const mobileData = data.map(d => ({ ...d, shortName: getInitials(d.name), fullName: d.name }));
    return (
      <ChartContainer
        config={chartConfig}
        style={{ width: '100%', height: 180 }}
      >
        <BarChart
          data={mobileData}
          margin={{ left: 4, right: 4, top: 8, bottom: 20 }}
          barCategoryGap="25%"
        >
          <XAxis
            dataKey="shortName"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#AAA', fontSize: 11, fontWeight: 600 }}
            interval={0}
            height={28}
          />
          <YAxis hide />
          <ChartTooltip cursor={false} content={<MobileBarTooltip />} />
          <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={4} />
        </BarChart>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      style={{ width: '100%', height: data.length * 56 + 16 }}
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 24, top: 4, bottom: 4 }}
      >
        <XAxis type="number" dataKey="quantidade" hide />
        <YAxis
          dataKey="name"
          type="category"
          tickLine={false}
          tickMargin={12}
          axisLine={false}
          width={130}
          tick={{ fill: '#D8D8D8', fontSize: 13, fontWeight: 600 }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="quantidade" fill="var(--color-quantidade)" radius={5} />
      </BarChart>
    </ChartContainer>
  );
}

type TabValue = 'vendas' | 'noshow' | 'remarketing';

const TAB_LABELS: Record<TabValue, string> = {
  vendas: 'Funil de vendas',
  noshow: 'Anti noshow',
  remarketing: 'Remarketing',
};

export function SalesFunnelTabs({ stages, antiNoshowCounts, remarketingCount = 0 }: SalesFunnelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('vendas');

  const salesData = stages.map(s => ({ name: s.label, quantidade: s.count }));
  const noshowData = NOSHOW_STAGES.map(s => ({
    name: s.label,
    quantidade: resolveNoshowCount(antiNoshowCounts, s.keys),
  }));

  const hasAntiNoshow = noshowData.some(d => d.quantidade > 0);
  const hasRemarketing = remarketingCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full"
    >
      <Card className="h-full flex flex-col overflow-hidden">
        <CardContent className="flex-1 pt-4 md:pt-6 px-4 md:px-6 flex flex-col">
          {/* Tabs */}
          <div className="mb-5 flex-shrink-0">
            <div className="flex items-center rounded-full p-1 w-fit bg-muted">
              {(Object.keys(TAB_LABELS) as TabValue[]).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="px-4 py-1.5 text-xs rounded-full transition-all duration-150 whitespace-nowrap"
                  style={activeTab === t
                    ? { backgroundColor: '#0F3D2B', color: '#fff', fontWeight: 600 }
                    : { color: 'var(--muted-foreground)', background: 'transparent', fontWeight: 500 }
                  }
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'vendas' && (
              salesData.every(d => d.quantidade === 0) ? (
                <EmptyState
                  message="Nenhum lead no funil ainda"
                  detail="Leads criados no CRM aparecem aqui por etapa."
                  href="/crm"
                  cta="Abrir CRM"
                />
              ) : (
                <HorizontalBars data={salesData} />
              )
            )}

            {activeTab === 'noshow' && (
              !hasAntiNoshow ? (
                <EmptyState
                  message="Nenhum disparo Anti Noshow no período"
                  detail="Configure sequências de Anti Noshow em Automações para reduzir faltas."
                  href="/automacoes"
                  cta="Configurar automação"
                />
              ) : (
                <HorizontalBars data={noshowData} />
              )
            )}

            {activeTab === 'remarketing' && (
              !hasRemarketing ? (
                <EmptyState
                  message="Nenhum lead de remarketing no período"
                  detail="Configure sequências de remarketing para reativar leads perdidos."
                  href="/automacoes"
                  cta="Configurar remarketing"
                />
              ) : (
                <HorizontalBars data={[{ name: 'Remarketing', quantidade: remarketingCount }]} />
              )
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState({ message, detail, href, cta }: { message: string; detail: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] md:h-[290px] gap-3 text-center">
      <Bell className="h-9 w-9 text-muted-foreground/25" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/60 max-w-xs">{detail}</p>
      <Link href={href} className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 mt-1">
        {cta} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
