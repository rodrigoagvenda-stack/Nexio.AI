'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Bell, ArrowRight, ChevronDown, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ymd } from '@/lib/utils/ymd';
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
  showAntiNoshow?: boolean;
  showRemarketing?: boolean;
  since?: Date;
  until?: Date;
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

type TabValue = 'vendas' | 'noshow' | 'remarketing' | 'promocoes';

const TAB_LABELS: Record<TabValue, string> = {
  vendas: 'Funil de vendas',
  noshow: 'Anti noshow',
  remarketing: 'Remarketing',
  promocoes: 'Promoções',
};

interface PromoData {
  sequences: { id: string; nome: string }[];
  selected: { id: string; nome: string; dispatched: number; messages: number; responded: number; bought: number; value: number } | null;
}

export function SalesFunnelTabs({ stages, antiNoshowCounts, remarketingCount = 0, showAntiNoshow = true, showRemarketing = true, since, until }: SalesFunnelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('vendas');
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoId, setPromoId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'promocoes' || !since || !until) return;
    setPromoLoading(true);
    const q = new URLSearchParams({ since: ymd(since), until: ymd(until) });
    if (promoId) q.set('sequence_id', promoId);
    fetch(`/api/reports/promocoes?${q}`).then((r) => (r.ok ? r.json() : null)).then(setPromo).catch(() => setPromo(null)).finally(() => setPromoLoading(false));
  }, [activeTab, since, until, promoId]);

  const [follow, setFollow] = useState<Record<string, FollowTipo | null>>({});
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if ((activeTab !== 'noshow' && activeTab !== 'remarketing') || !since || !until) return;
    const tipo = activeTab === 'noshow' ? 'anti_noshow' : 'remarketing';
    setFollowLoading(true);
    const q = new URLSearchParams({ tipo, since: ymd(since), until: ymd(until) });
    fetch(`/api/reports/follow-tipo?${q}`).then((r) => (r.ok ? r.json() : null)).then((d) => setFollow((f) => ({ ...f, [tipo]: d }))).catch(() => setFollow((f) => ({ ...f, [tipo]: null }))).finally(() => setFollowLoading(false));
  }, [activeTab, since, until]);

  const salesData = stages.map(s => ({ name: s.label, quantidade: s.count }));

  const visibleTabs = (Object.keys(TAB_LABELS) as TabValue[]).filter(t => {
    if (t === 'noshow' && !showAntiNoshow) return false;
    if (t === 'remarketing' && !showRemarketing) return false;
    return true;
  });

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
          <div className="mb-5 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center rounded-full p-1 w-fit bg-muted">
              {visibleTabs.map(t => (
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
            {activeTab === 'promocoes' && promo && promo.sequences.length > 0 && (
              <label className="relative flex items-center">
                <span className="sr-only">Escolher a promoção</span>
                <select value={promo.selected?.id ?? ''} onChange={(e) => setPromoId(e.target.value)} className="h-9 max-w-[260px] appearance-none truncate rounded-full border border-border bg-card py-0 pl-4 pr-9 text-[13px] font-semibold text-foreground outline-none">
                  {promo.sequences.map((q) => <option key={q.id} value={q.id}>{q.nome}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-muted-foreground" />
              </label>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'vendas' && (
              salesData.every(d => d.quantidade === 0) ? (
                <EmptyState
                  message="Nenhum lead entrou neste período"
                  detail="Leads criados no CRM no período escolhido aparecem aqui por etapa."
                  href="/crm"
                  cta="Abrir CRM"
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground">Leads que entraram no período, por etapa em que estão agora.</p>
                  <HorizontalBars data={salesData} />
                </div>
              )
            )}

            {(activeTab === 'noshow' || activeTab === 'remarketing') && (() => {
              const isNoshow = activeTab === 'noshow';
              const d = follow[isNoshow ? 'anti_noshow' : 'remarketing'];
              if (followLoading && !d) return <div className="h-[240px] animate-pulse rounded-xl bg-muted" />;
              if (!d || !d.configured || d.messages === 0) {
                return (
                  <EmptyState
                    message={isNoshow ? 'Nenhum disparo Anti noshow no período' : 'Nenhum disparo de remarketing no período'}
                    detail={isNoshow ? 'Configure sequências de Anti noshow em Automações para reduzir faltas.' : 'Configure sequências de remarketing para reativar leads perdidos.'}
                    href="/configuracoes/follow"
                    cta={isNoshow ? 'Configurar automação' : 'Configurar remarketing'}
                  />
                );
              }
              return <FollowPanel data={d} noshow={isNoshow} since={since} until={until} />;
            })()}
            {activeTab === 'promocoes' && (
              promoLoading && !promo ? (
                <div className="h-[240px] animate-pulse rounded-xl bg-muted" />
              ) : !promo || promo.sequences.length === 0 || !promo.selected ? (
                <EmptyState
                  message="Nenhuma promoção criada ainda"
                  detail="Crie uma sequência que começa pela etiqueta Promoção para ver aqui quem respondeu e quem comprou."
                  href="/configuracoes/follow"
                  cta="Abrir sequências"
                />
              ) : (
                <PromoPanel data={promo.selected} since={since} until={until} />
              )
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dmy = (d?: Date) => (d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '');

function DropChip({ children }: { children: React.ReactNode }) {
  return <span className="ml-[92px] flex w-fit items-center gap-1.5 rounded-full bg-[#F5B544]/[0.16] px-3 py-1 text-xs font-semibold text-[#8A5A00] dark:text-[#F5B544]"><ArrowDown className="h-3 w-3" />{children}</span>;
}

function PromoPanel({ data, since, until }: { data: NonNullable<PromoData['selected']>; since?: Date; until?: Date }) {
  const width = (n: number) => (data.dispatched > 0 ? Math.max(n > 0 ? 6 : 0.6, Math.round((n / data.dispatched) * 100)) : 0.6);
  const rows: [string, number][] = [['Disparei para', data.dispatched], ['Responderam', data.responded], ['Compraram', data.bought]];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Disparos da sequência de Promoção do canvas, de {dmy(since)} a {dmy(until)}. Escolha a promoção no seletor.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-6 dark:bg-[#141414]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1"><span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground">RESULTADO DA PROMOÇÃO</span><span className="text-sm text-foreground/85">Para quantos foi, quem respondeu e quem comprou</span></div>
            <div className="flex flex-col items-end"><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{pct(data.bought, data.dispatched)}%</span><span className="text-[13px] text-muted-foreground">compraram</span></div>
          </div>
          {rows.map(([label, n], i) => (
            <div key={label} className="flex flex-col gap-3">
              {i === 1 && <DropChip>{pct(data.responded, data.dispatched)}% responderam</DropChip>}
              {i === 2 && <DropChip>{pct(data.bought, data.dispatched)}% compraram</DropChip>}
              <div className="flex items-center gap-4">
                <span className="w-[76px] shrink-0 text-right text-sm font-semibold text-foreground">{label}</span>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="h-11 rounded-md bg-[#01573C]/70 dark:bg-[#1F5A3D]" style={{ width: `${i === 0 ? (data.dispatched > 0 ? 100 : 0.6) : width(n)}%`, minWidth: 3 }} />
                  <span className="text-2xl font-semibold text-foreground">{n}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-6 dark:bg-[#141414]"><span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground">MENSAGENS ENVIADAS</span><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{data.messages}</span><span className="text-[13px] text-muted-foreground">Passos da sequência enviados aos {data.dispatched} leads</span></div>
          <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-6 dark:bg-[#141414]"><span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground">VALOR VENDIDO</span><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{brl(data.value)}</span><span className="text-[13px] text-muted-foreground">Soma dos fechamentos depois do primeiro disparo</span></div>
        </div>
      </div>
    </div>
  );
}

interface FollowTipo { configured: boolean; steps: { label: string; sent: number }[]; leads: number; messages: number; responded: number }

function FollowPanel({ data, noshow, since, until }: { data: FollowTipo; noshow: boolean; since?: Date; until?: Date }) {
  const max = Math.max(1, ...data.steps.map((s) => s.sent));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{noshow ? 'Lembretes enviados antes e depois da call' : 'Mensagens de reativação enviadas'}, de {dmy(since)} a {dmy(until)}.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-6 dark:bg-[#141414]">
          <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground">{noshow ? 'ENVIOS POR LEMBRETE' : 'ENVIOS POR PASSO'}</span>
          {data.steps.map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <span className="w-[92px] shrink-0 text-right text-sm font-semibold text-foreground">{s.label}</span>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="h-9 rounded-md bg-[#01573C]/70 dark:bg-[#1F5A3D]" style={{ width: `${Math.max(s.sent > 0 ? 6 : 0.6, Math.round((s.sent / max) * 100))}%`, minWidth: 3 }} />
                <span className="text-xl font-semibold text-foreground">{s.sent}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-6 dark:bg-[#141414]"><span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground">LEADS ALCANÇADOS</span><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{data.leads}</span><span className="text-[13px] text-muted-foreground">{data.messages} mensagens enviadas</span></div>
          <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border bg-muted/40 p-6 dark:bg-[#141414]"><span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground">RESPONDERAM</span><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{data.responded}</span><span className="text-[13px] text-muted-foreground">{pct(data.responded, data.leads)}% dos leads alcançados responderam depois do primeiro envio</span></div>
        </div>
      </div>
    </div>
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
