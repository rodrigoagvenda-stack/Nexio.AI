'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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

/* Barras pill — estilo do design */
function FunnelPillBars({ data }: { data: { name: string; quantidade: number }[] }) {
  const max = Math.max(...data.map(d => d.quantidade), 1);
  return (
    <div className="flex flex-col gap-2.5 pt-2">
      {data.map((item) => (
        <div
          key={item.name}
          className="flex items-center justify-between rounded-full px-5"
          style={{
            height: 48,
            backgroundColor: '#0A3728',
            minWidth: 0,
          }}
        >
          <span className="text-sm font-semibold text-white truncate">{item.name}</span>
          <span className="text-sm font-medium ml-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {item.quantidade}
          </span>
        </div>
      ))}
    </div>
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
          <div className="mb-5">
            <div className="flex items-center rounded-full p-1 w-fit" style={{ backgroundColor: '#141414' }}>
              {(Object.keys(TAB_LABELS) as TabValue[]).map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="px-4 py-1.5 text-xs rounded-full transition-all duration-150 whitespace-nowrap"
                  style={activeTab === t
                    ? { backgroundColor: '#0F3D2B', color: '#fff', fontWeight: 600 }
                    : { color: '#888', background: 'transparent', fontWeight: 500 }
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
                <FunnelPillBars data={salesData} />
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
                <FunnelPillBars data={noshowData} />
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
                <FunnelPillBars data={[{ name: 'Remarketing', quantidade: remarketingCount }]} />
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
