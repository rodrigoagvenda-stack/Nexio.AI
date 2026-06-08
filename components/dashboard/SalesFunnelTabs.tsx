'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { motion } from 'framer-motion';
import { Bell, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface FunnelStage {
  label: string;
  count: number;
}

interface SalesFunnelTabsProps {
  stages: FunnelStage[];
  antiNoshowCounts: Record<string, number>;
  remarketingCount?: number;
}

const salesColors  = ['#052e16', '#14532d', '#166534', '#15803d', '#16a34a', '#22c55e'];
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

function FunnelBarChart({ data }: { data: { name: string; quantidade: number; fill: string }[] }) {
  const maxQty = Math.max(...data.map(d => d.quantidade), 1);

  return (
    <div className="h-[220px] md:h-[290px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          barSize={28}
          barCategoryGap="28%"
          margin={{ top: 4, right: 44, left: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" opacity={0.2} />
          <YAxis type="category" dataKey="name" hide />
          <XAxis type="number" hide domain={[0, maxQty * 1.15]} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: 12,
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            itemStyle={{ color: 'hsl(var(--primary))' }}
            cursor={{ fill: 'hsl(var(--accent))' }}
            formatter={(v: number) => [v, 'Leads']}
          />
          <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} animationDuration={800} minPointSize={72}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            <LabelList
              dataKey="name"
              position="insideLeft"
              offset={12}
              style={{ fill: '#fff', fontSize: 11, fontWeight: 600 }}
              formatter={(v: string) => v.length > 16 ? v.slice(0, 15) + '…' : v}
            />
            <LabelList
              dataKey="quantidade"
              position="right"
              offset={8}
              style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 700 }}
            />
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

export function SalesFunnelTabs({ stages, antiNoshowCounts, remarketingCount = 0 }: SalesFunnelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('vendas');

  const salesData = stages.map((s, i) => ({
    name: s.label, quantidade: s.count, fill: salesColors[i % salesColors.length],
  }));

  const noshowData = NOSHOW_STAGES.map((s, i) => ({
    name: s.label,
    quantidade: resolveNoshowCount(antiNoshowCounts, s.keys),
    fill: noshowColors[i],
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
          <div className="mb-4">
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
            {activeTab === 'vendas' && (
              salesData.every(d => d.quantidade === 0) ? (
                <EmptyState
                  message="Nenhum lead no funil ainda"
                  detail="Leads criados no CRM aparecem aqui por etapa."
                  href="/crm"
                  cta="Abrir CRM"
                />
              ) : (
                <FunnelBarChart data={salesData} />
              )
            )}

            {activeTab === 'noshow' && (
              !hasAntiNoshow ? (
                <EmptyState
                  message="Nenhum disparo Anti Noshow no período"
                  detail="Configure sequências de Anti Noshow em Automações para reduzir faltas."
                  href="/automacoes"
                  cta="Configurar automacao"
                />
              ) : (
                <FunnelBarChart data={noshowData} />
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
                <FunnelBarChart data={[{ name: 'Remarketing', quantidade: remarketingCount, fill: '#15803d' }]} />
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
      <Link
        href={href}
        className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 mt-1"
      >
        {cta}
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
