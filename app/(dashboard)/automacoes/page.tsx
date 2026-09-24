'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutomationsNav } from '@/components/automacoes/AutomationsNav';
import { cn } from '@/lib/utils';

interface Overview {
  sequences: { total: number; active: number };
  messages30: number;
  lastSentAt: string | null;
  sentToday: number;
  sentYesterday: number;
  today: string;
  yesterday: string;
  recent: { at: string; day: string; time: string; lead: string; automation: string }[];
  attention: { title: string; text: string }[];
  sdrActive: boolean;
  outboundCampaigns: number;
}

const CARD = 'rounded-[14px] border border-border bg-card';

export default function AutomacoesPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/automacoes/overview')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const last = data?.lastSentAt ? new Date(data.lastSentAt) : null;
  const summary = data
    ? [
        `${data.sequences.active} de ${data.sequences.total} ${data.sequences.total === 1 ? 'ligada' : 'ligadas'}`,
        `${data.messages30} ${data.messages30 === 1 ? 'mensagem' : 'mensagens'} em 30 dias`,
        last ? `último disparo em ${last.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${last.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'nenhum disparo ainda',
      ].join(' · ')
    : 'Sequências, SDR, Outbound e calendário no mesmo lugar';

  // Agrupa por dia mantendo a ordem (mais recente primeiro)
  const days: { day: string; items: Overview['recent'] }[] = [];
  data?.recent.forEach((r) => {
    const g = days.find((d) => d.day === r.day);
    if (g) g.items.push(r); else days.push({ day: r.day, items: [r] });
  });

  const open = data && [
    { label: 'Agente SDR', value: data.sdrActive ? 'Ligado' : 'Desligado', href: '/configuracoes/sdr', tone: data.sdrActive },
    { label: 'Sequências', value: `${data.sequences.active} de ${data.sequences.total} ligadas`, href: '/configuracoes/follow', tone: false },
    { label: 'Outbound', value: `${data.outboundCampaigns} ${data.outboundCampaigns === 1 ? 'campanha' : 'campanhas'}`, href: '/outbound', tone: false },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Automações</h1>
          <p className="text-[15px] text-muted-foreground">{summary}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="h-12 px-6 text-[15px]" asChild><Link href="/configuracoes/follow">Abrir canvas</Link></Button>
          <Button className="h-12 px-6 text-[15px]" asChild><Link href="/configuracoes/follow">Nova automação</Link></Button>
        </div>
      </div>

      <AutomationsNav active="geral" />

      {loading ? (
        <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : failed || !data ? (
        <p className="py-16 text-center text-muted-foreground">Não foi possível carregar as automações agora. Tente de novo em instantes.</p>
      ) : (
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <section className="min-w-0 flex-1">
            <div className="mb-3.5 flex flex-col gap-1">
              <h2 className="text-xl font-semibold text-foreground">Atividade recente</h2>
              <p className="text-sm text-muted-foreground">Últimas mensagens enviadas pelas automações</p>
            </div>
            <div className={cn(CARD, 'overflow-hidden')}>
              {data.sentToday === 0 && (
                <p className="flex items-center gap-3 border-b border-border bg-amber-500/[0.08] px-6 py-3.5 text-sm text-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  Hoje, {data.today} · nenhuma mensagem enviada.{data.sentYesterday === 0 ? ` Também nada em ${data.yesterday}.` : ''}
                </p>
              )}
              {days.length === 0 ? (
                <p className="px-6 py-14 text-center text-[15px] text-muted-foreground">Nenhuma mensagem enviada pelas automações nos últimos 30 dias.</p>
              ) : days.map((g) => (
                <div key={g.day}>
                  <p className="px-6 pb-1.5 pt-4 text-[13px] font-medium text-muted-foreground">{g.day}</p>
                  {g.items.map((r, i) => (
                    <div key={`${r.at}-${i}`} className="flex items-center gap-5 border-t border-border px-6 py-3.5">
                      <span className="w-12 shrink-0 text-sm tabular-nums text-muted-foreground">{r.time}</span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{r.lead}</span>
                      <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">{r.automation}</span>
                    </div>
                  ))}
                </div>
              ))}
              <Link href="/configuracoes/agenda" className="block border-t border-border px-6 py-3.5 text-center text-sm font-semibold text-[#01573C] hover:underline dark:text-[#96F63C]">Ver todos os disparos no Calendário</Link>
            </div>
          </section>

          <aside className="flex w-full shrink-0 flex-col gap-8 xl:w-[440px]">
            <section className="flex flex-col gap-3.5">
              <h2 className="text-xl font-semibold text-foreground">Precisa de atenção</h2>
              <div className={cn(CARD, 'flex flex-col')}>
                {data.attention.length === 0 ? (
                  <p className="px-6 py-6 text-[15px] text-muted-foreground">Nada pedindo atenção agora.</p>
                ) : data.attention.map((a, i) => (
                  <div key={a.title} className={cn('flex flex-col gap-1.5 px-6 py-5', i > 0 && 'border-t border-border')}>
                    <p className="flex items-center gap-3 text-[15px] font-semibold text-foreground"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{a.title}</p>
                    <p className="pl-[18px] text-sm leading-normal text-muted-foreground">{a.text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3.5">
              <h2 className="text-xl font-semibold text-foreground">Abrir</h2>
              <div className={cn(CARD, 'flex flex-col')}>
                {open?.map((o, i) => (
                  <Link key={o.label} href={o.href} className={cn('flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-muted', i > 0 && 'border-t border-border', i === 0 && 'rounded-t-[14px]', i === open.length - 1 && 'rounded-b-[14px]')}>
                    <span className="text-[15px] font-semibold text-foreground">{o.label}</span>
                    <span className="flex items-center gap-2 text-sm text-muted-foreground"><span className={cn(o.tone && 'text-[#01573C] dark:text-[#96F63C]')}>{o.value}</span><ChevronRight className="h-4 w-4" /></span>
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
