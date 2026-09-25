'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Bell, ArrowRight, ChevronDown, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ymd } from '@/lib/utils/ymd';
import Link from 'next/link';

// Kept for the dashboard page call site. The card now reads its own numbers from /api/reports/dashboard-funil.
interface SalesFunnelTabsProps {
  stages?: { label: string; count: number }[];
  antiNoshowCounts?: Record<string, number>;
  remarketingCount?: number;
  showAntiNoshow?: boolean;
  showRemarketing?: boolean;
  since?: Date;
  until?: Date;
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

interface DashFunil {
  conversao: { inbound: number; responderam: number; agendadas: number; realizadas: number; fechados: number; nao_responderam: number; no_show: number; sem_resultado: number };
  agora: { total: number; etapas: { label: string; count: number }[]; perdidos: number };
  noshow: { agendadas: number; passadas: number; compareceram: number; no_show: number; sem_resultado: number; futuras: number };
}

interface FollowTipo { configured: boolean; steps: { label: string; sent: number }[]; leads: number; messages: number; responded: number; returned?: number; queue?: number }

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dmy = (d?: Date) => (d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '');

const CAP = 'text-xs font-semibold tracking-[0.1em] text-muted-foreground';
const PANEL = 'flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-6 dark:bg-[#141414]';
const BAR = 'bg-[#01573C]/70 dark:bg-[#1F5A3D]';
const BAR_HI = 'bg-[#01573C] dark:bg-[#4CBF80]';
const BAR_GREY = 'bg-muted-foreground/30 dark:bg-[#3A3A3A]';
const BAR_AMBER = 'bg-[#F5B544]';

function Chip({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <span className={cn('ml-[156px] flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', warn ? 'bg-[#F5B544]/[0.16] text-[#8A5A00] dark:text-[#F5B544]' : 'bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C]/[0.12] dark:text-[#5BBE7E]')}>
      <ArrowDown className="h-3 w-3" />{children}
    </span>
  );
}

function Row({ label, n, max, bar, note, small }: { label: string; n: number; max: number; bar: string; note?: string; small?: boolean }) {
  const width = max > 0 ? Math.max(n > 0 ? 3 : 0.4, Math.round((n / max) * 100)) : 0.4;
  return (
    <div className="flex items-center gap-4">
      <span className={cn('w-[140px] shrink-0 text-right font-semibold text-foreground', small ? 'text-sm text-muted-foreground' : 'text-sm')}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className={cn('rounded-md', small ? 'h-8' : 'h-11', bar)} style={{ width: `${width}%`, minWidth: 3 }} />
        <span className={cn('font-semibold text-foreground', small ? 'text-xl' : 'text-2xl')}>{n}</span>
        {note && <span className="text-[13px] text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

function ConversaoPanel({ d, since, until }: { d: DashFunil['conversao']; since?: Date; until?: Date }) {
  const max = Math.max(1, d.inbound);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Leads inbound de {dmy(since)} a {dmy(until)}. A porcentagem é sobre a etapa anterior.</p>
      <div className="flex flex-col gap-3">
        <Row label="Leads inbound" n={d.inbound} max={max} bar={BAR} />
        <Chip>{pct(d.responderam, d.inbound)}% responderam</Chip>
        <Row label="Responderam" n={d.responderam} max={max} bar={BAR} />
        <Chip>{pct(d.agendadas, d.responderam)}% marcaram reunião</Chip>
        <Row label="Reunião agendada" n={d.agendadas} max={max} bar={BAR} />
        <Chip>{pct(d.realizadas, d.agendadas)}% compareceram</Chip>
        <Row label="Reunião realizada" n={d.realizadas} max={max} bar={BAR} />
        <Chip>{pct(d.fechados, d.realizadas)}% fecharam</Chip>
        <Row label="Fechamento" n={d.fechados} max={max} bar={BAR_HI} />
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className={cn(CAP, 'ml-[156px]')}>NÃO AVANÇARAM</span>
        <Row small label="Não responderam" n={d.nao_responderam} max={max} bar={BAR_GREY} note={`${pct(d.nao_responderam, d.inbound)}% dos leads`} />
        <Row small label="Não compareceram" n={d.no_show} max={max} bar={BAR_AMBER} note={`${pct(d.no_show, d.agendadas)}% das agendadas (no-show)`} />
      </div>
      {d.sem_resultado > 0 && (
        <p className="ml-[156px] text-[13px] leading-[150%] text-muted-foreground">{d.sem_resultado} {d.sem_resultado === 1 ? 'reunião já passou' : 'reuniões já passaram'} sem o resultado marcado no CRM. Marque como realizada ou no-show para o funil ficar certo.</p>
      )}
    </div>
  );
}

function AgoraPanel({ d }: { d: DashFunil['agora'] }) {
  const max = Math.max(1, ...d.etapas.map((e) => e.count), d.perdidos);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{d.total} leads inbound do período, na etapa em que cada um está hoje. Perdidos incluídos.</p>
      <div className="flex flex-col gap-3">
        {d.etapas.map((e) => (
          <Row key={e.label} label={e.label} n={e.count} max={max} bar={e.label === 'Fechado' ? BAR_HI : BAR} note={`${pct(e.count, d.total)}%`} />
        ))}
      </div>
      <div className="border-t border-border pt-4">
        <Row label="Perdido" n={d.perdidos} max={max} bar={BAR_GREY} note={`${pct(d.perdidos, d.total)}%`} />
      </div>
    </div>
  );
}

function StatCard({ cap, value, text }: { cap: string; value: React.ReactNode; text: string }) {
  return (
    <div className={cn(PANEL, 'flex-1 gap-2')}>
      <span className={CAP}>{cap}</span>
      <span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{value}</span>
      <span className="text-[13px] leading-[150%] text-muted-foreground">{text}</span>
    </div>
  );
}

function NoshowPanel({ d, follow, since, until }: { d: DashFunil['noshow']; follow: FollowTipo | null; since?: Date; until?: Date }) {
  const max = Math.max(1, d.agendadas);
  const attended = d.passadas > 0 ? `${pct(d.compareceram, d.passadas)}%` : '-';
  const answered = follow?.responded ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Reuniões agendadas de {dmy(since)} a {dmy(until)} e os lembretes enviados para elas.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={PANEL}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1"><span className={CAP}>RESULTADO DAS REUNIÕES</span><span className="text-sm text-foreground/85">Quem agendou e chegou de fato</span></div>
            <div className="flex flex-col items-end"><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{attended}</span><span className="text-[13px] text-muted-foreground">comparecimento</span></div>
          </div>
          <Row label="Agendadas" n={d.agendadas} max={max} bar={BAR} />
          <Row label="Compareceram" n={d.compareceram} max={max} bar={BAR} />
          <Row label="No-show" n={d.no_show} max={max} bar={BAR_AMBER} note={`${pct(d.no_show, d.passadas)}% das agendadas`} />
          {d.sem_resultado > 0 && <p className="text-[13px] leading-[150%] text-muted-foreground">{d.sem_resultado} {d.sem_resultado === 1 ? 'reunião já passou' : 'reuniões já passaram'} sem o resultado marcado no CRM.</p>}
          {d.futuras > 0 && <p className="text-[13px] text-muted-foreground">{d.futuras} ainda {d.futuras === 1 ? 'vai acontecer' : 'vão acontecer'}.</p>}
        </div>
        <div className="flex flex-col gap-4">
          <StatCard cap="LEMBRETES ENVIADOS" value={follow?.messages ?? 0} text="Anti noshow disparado no período" />
          <StatCard cap="RESPONDERAM AO LEMBRETE" value={answered > 0 ? answered : '-'} text={follow && follow.leads > 0 && answered > 0 ? `${pct(answered, follow.leads)}% dos ${follow.leads} leads alcançados responderam depois do primeiro lembrete` : 'Aparece aqui quando alguém responder a um lembrete'} />
        </div>
      </div>
    </div>
  );
}

function RemarketingPanel({ d, since, until }: { d: FollowTipo; since?: Date; until?: Date }) {
  const max = Math.max(1, d.leads);
  const returned = d.returned ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Leads que receberam remarketing de {dmy(since)} a {dmy(until)} e o que aconteceu depois.</p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={PANEL}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1"><span className={CAP}>RESULTADO DO REMARKETING</span><span className="text-sm text-foreground/85">Quem recebeu e quem voltou</span></div>
            <div className="flex flex-col items-end"><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{pct(d.responded, d.leads)}%</span><span className="text-[13px] text-muted-foreground">voltaram a responder</span></div>
          </div>
          <div className="flex flex-col gap-3">
            <Row label="Receberam" n={d.leads} max={max} bar={BAR} />
            <Chip>{pct(d.responded, d.leads)}% responderam depois</Chip>
            <Row label="Voltaram a responder" n={d.responded} max={max} bar={BAR} />
            <Chip warn>{pct(returned, d.responded)}% voltaram ao funil</Chip>
            <Row label="Voltaram ao funil" n={returned} max={max} bar={BAR_HI} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <StatCard cap="DISPAROS ENVIADOS" value={d.messages} text={d.messages === d.leads ? `Uma mensagem para cada um dos ${d.leads} leads` : `${d.messages} mensagens para ${d.leads} leads`} />
          <StatCard cap="NA FILA AGORA" value={d.queue ?? 0} text="Leads no status Remarketing esperando o próximo disparo" />
        </div>
      </div>
    </div>
  );
}

export function SalesFunnelTabs({ showAntiNoshow = true, showRemarketing = true, since, until }: SalesFunnelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('vendas');
  const [view, setView] = useState<'conversao' | 'agora'>('conversao');
  const [promo, setPromo] = useState<PromoData | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoId, setPromoId] = useState<string | null>(null);
  const [dash, setDash] = useState<DashFunil | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [follow, setFollow] = useState<Record<string, FollowTipo | null>>({});
  const [followLoading, setFollowLoading] = useState(false);

  const range = since && until ? new URLSearchParams({ since: ymd(since), until: ymd(until) }) : null;

  useEffect(() => {
    if (activeTab !== 'promocoes' || !range) return;
    setPromoLoading(true);
    const q = new URLSearchParams(range);
    if (promoId) q.set('sequence_id', promoId);
    fetch(`/api/reports/promocoes?${q}`).then((r) => (r.ok ? r.json() : null)).then(setPromo).catch(() => setPromo(null)).finally(() => setPromoLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, since, until, promoId]);

  useEffect(() => {
    if ((activeTab !== 'vendas' && activeTab !== 'noshow') || !range) return;
    setDashLoading(true);
    fetch(`/api/reports/dashboard-funil?${range}`).then((r) => (r.ok ? r.json() : null)).then(setDash).catch(() => setDash(null)).finally(() => setDashLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, since, until]);

  useEffect(() => {
    if ((activeTab !== 'noshow' && activeTab !== 'remarketing') || !range) return;
    const tipo = activeTab === 'noshow' ? 'anti_noshow' : 'remarketing';
    setFollowLoading(true);
    const q = new URLSearchParams(range);
    q.set('tipo', tipo);
    fetch(`/api/reports/follow-tipo?${q}`).then((r) => (r.ok ? r.json() : null)).then((d) => setFollow((f) => ({ ...f, [tipo]: d }))).catch(() => setFollow((f) => ({ ...f, [tipo]: null }))).finally(() => setFollowLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, since, until]);

  const visibleTabs = (Object.keys(TAB_LABELS) as TabValue[]).filter((t) => {
    if (t === 'noshow' && !showAntiNoshow) return false;
    if (t === 'remarketing' && !showRemarketing) return false;
    return true;
  });

  const skeleton = <div className="h-[280px] animate-pulse rounded-xl bg-muted" />;
  const pill = (active: boolean) => ({ backgroundColor: active ? '#0F3D2B' : 'transparent', color: active ? '#fff' : 'var(--muted-foreground)', fontWeight: active ? 600 : 500 });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="h-full">
      <Card className="h-full flex flex-col overflow-hidden">
        <CardContent className="flex-1 pt-4 md:pt-6 px-4 md:px-6 flex flex-col">
          <div className="mb-5 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center rounded-full p-1 w-fit bg-muted">
              {visibleTabs.map((t) => (
                <button key={t} onClick={() => setActiveTab(t)} className="px-4 py-1.5 text-xs rounded-full transition-all duration-150 whitespace-nowrap" style={pill(activeTab === t)}>
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            {activeTab === 'vendas' && (
              <div className="flex items-center rounded-full p-1 w-fit bg-muted">
                <button onClick={() => setView('conversao')} className="px-4 py-1.5 text-xs rounded-full transition-all duration-150 whitespace-nowrap" style={pill(view === 'conversao')}>Conversão</button>
                <button onClick={() => setView('agora')} className="px-4 py-1.5 text-xs rounded-full transition-all duration-150 whitespace-nowrap" style={pill(view === 'agora')}>Onde estão agora</button>
              </div>
            )}
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
              dashLoading && !dash ? skeleton
                : !dash || dash.conversao.inbound === 0 ? (
                  <EmptyState message="Nenhum lead entrou neste período" detail="Leads que chegam pelo WhatsApp no período escolhido aparecem aqui." href="/crm" cta="Abrir CRM" />
                ) : view === 'conversao' ? <ConversaoPanel d={dash.conversao} since={since} until={until} /> : <AgoraPanel d={dash.agora} />
            )}

            {activeTab === 'noshow' && (() => {
              const f = follow['anti_noshow'] ?? null;
              if ((dashLoading || followLoading) && !dash) return skeleton;
              if (!dash || (dash.noshow.agendadas === 0 && (f?.messages ?? 0) === 0)) {
                return <EmptyState message="Nenhuma reunião agendada no período" detail="Configure sequências de Anti noshow em Automações para reduzir faltas." href="/configuracoes/follow" cta="Configurar automação" />;
              }
              return <NoshowPanel d={dash.noshow} follow={f} since={since} until={until} />;
            })()}

            {activeTab === 'remarketing' && (() => {
              const f = follow['remarketing'] ?? null;
              if (followLoading && !f) return skeleton;
              if (!f || !f.configured || f.messages === 0) {
                return <EmptyState message="Nenhum disparo de remarketing no período" detail="Configure sequências de remarketing para reativar leads perdidos." href="/configuracoes/follow" cta="Configurar remarketing" />;
              }
              return <RemarketingPanel d={f} since={since} until={until} />;
            })()}

            {activeTab === 'promocoes' && (
              promoLoading && !promo ? skeleton
                : !promo || promo.sequences.length === 0 || !promo.selected ? (
                  <EmptyState message="Nenhuma promoção criada ainda" detail="Crie uma sequência que começa pela etiqueta Promoção para ver aqui quem respondeu e quem comprou." href="/configuracoes/follow" cta="Abrir sequências" />
                ) : <PromoPanel data={promo.selected} since={since} until={until} />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
