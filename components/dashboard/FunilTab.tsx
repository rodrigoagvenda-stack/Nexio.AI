'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FunilData {
  chegaram: number;
  responderam: number;
  agendadas: number;
  realizadas: number;
  vendas_fechadas: number;
  no_show: number;
  sem_resultado: number;
  faturamento_cents: number;
  ticket_medio_cents: number | null;
  velocidade: { contato_reuniao_dias: number | null; reuniao_fechamento_dias: number | null; lead_venda_dias: number | null; amostra_reunioes: number; amostra_vendas: number };
  perdidos: { total: number; com_motivo: number; motivos: { motivo: string; count: number }[] };
  gasto_trafego_cents?: number;
  custo_por_agendada_cents?: number | null;
  custo_por_realizada_cents?: number | null;
  cac_cents?: number | null;
  cpl_cents?: number | null;
  roas?: number | null;
}

const CARD = 'rounded-[14px] border border-border bg-card';
const LIME = 'text-[#01573C] dark:text-[#96F63C]';
const brl = (cents: number | null | undefined, digits = 2) => (cents == null ? '-' : `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`);
const pct = (num: number, den: number) => (den > 0 ? Math.min(100, Math.round((num / den) * 100)) : null);
const dayFmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

function useFunil(origem: 'inbound' | 'outbound', range: { from: Date; to: Date } | null) {
  const [data, setData] = useState<FunilData | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!range) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ origem, since: range.from.toISOString(), until: range.to.toISOString() });
    fetch(`/api/reports/funil?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [origem, range?.from.getTime(), range?.to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading };
}

function Delta({ now, before, label }: { now: number; before: number | undefined; label: string }) {
  if (before == null || before === 0) return <span className="text-xs text-muted-foreground">- {label}</span>;
  const d = Math.round(((now - before) / before) * 100);
  return <span className={cn('text-xs', d > 0 ? 'text-green-700 dark:text-green-400' : d < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>{d > 0 ? '+' : ''}{d}% {label}</span>;
}

function Bar({ value, tone }: { value: number; tone: 'green' | 'amber' | 'lime' }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full', tone === 'amber' ? 'bg-amber-500' : tone === 'lime' ? 'bg-[#96F63C]' : 'bg-[#01573C] dark:bg-[#1E6B47]')} style={{ width: `${Math.min(100, Math.max(value, value > 0 ? 3 : 0))}%` }} />
    </div>
  );
}

export function FunilTab({ range, prevRange, periodLabel }: { range: { from: Date; to: Date } | null; prevRange: { from: Date; to: Date } | null; periodLabel: string }) {
  const [origem, setOrigem] = useState<'inbound' | 'outbound'>('inbound');
  const { data, loading } = useFunil(origem, range);
  const { data: prev } = useFunil(origem, prevRange);

  const seg = (on: boolean) => cn('rounded-full px-4 py-1.5 text-sm transition-colors', on ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground');

  if (!range) return <p className="py-16 text-center text-muted-foreground">Escolha o período para ver o funil.</p>;

  const d = data;
  const vs = `vs ${periodLabel === 'Hoje' ? 'ontem' : 'período anterior'}`;
  const ag = d?.agendadas ?? 0, re = d?.realizadas ?? 0, ns = d?.no_show ?? 0, vf = d?.vendas_fechadas ?? 0, ch = d?.chegaram ?? 0;
  const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
  const rangeLabel = `${dayFmt(range.from)} a ${dayFmt(range.to)}`;
  const north = (r: number | null) => (r == null ? '-' : Number.isInteger(r) || r >= 10 ? String(Math.round(r)) : `${Math.floor(r)} a ${Math.ceil(r)}`);

  const rates = [
    { label: 'Efetivação', v: pct(re, ag), note: `${re} de ${ag} agendadas aconteceram`, tone: 'green' as const },
    { label: 'Não comparecimento', v: pct(ns, ag), note: `${ns} de ${ag} agendadas faltaram`, tone: 'amber' as const },
    { label: 'Fechamento sobre efetivadas', v: pct(vf, re), note: `${vf} de ${re} reuniões viraram venda`, tone: 'lime' as const, hi: true },
    { label: 'Fechamento sobre agendadas', v: pct(vf, ag), note: `${vf} de ${ag}, contando quem faltou`, tone: 'green' as const },
    { label: 'Conversa em agendamento', v: pct(ag, ch), note: `${ag} reuniões de ${ch} conversas`, tone: 'green' as const },
    { label: 'Conversa em venda', v: pct(vf, ch), note: `${vf} vendas de ${ch} conversas`, tone: 'green' as const },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Origem" className="flex w-fit items-center rounded-full bg-muted p-1">
          {(['inbound', 'outbound'] as const).map((o) => (
            <button key={o} type="button" role="tab" aria-selected={origem === o} onClick={() => setOrigem(o)} className={seg(origem === o)}>{o === 'inbound' ? 'Inbound' : 'Outbound'}</button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Reuniões e custos de {rangeLabel}</p>
      </div>

      {loading && !d ? (
        <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !d ? (
        <p className="py-16 text-center text-muted-foreground">Não foi possível carregar o funil agora. Tente de novo em instantes.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { t: 'Reuniões agendadas', n: String(ag), now: ag, before: prev?.agendadas, tone: '' },
              { t: 'Reuniões efetivadas', n: String(re), now: re, before: prev?.realizadas, tone: '' },
              { t: 'Não compareceram (no-show)', n: String(ns), now: ns, before: prev?.no_show, tone: 'text-amber-600 dark:text-amber-400' },
              { t: 'Fechamentos', n: String(vf), now: vf, before: prev?.vendas_fechadas, tone: LIME },
            ].map((k) => (
              <div key={k.t} className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
                <p className="text-[15px] text-foreground/85">{k.t}</p>
                <p className={cn('text-[34px] font-semibold leading-[42px] tracking-tight', k.tone || 'text-foreground')}>{k.n}</p>
                <Delta now={k.now} before={k.before} label={vs} />
              </div>
            ))}
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Ticket médio</p>
              <p className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{d.ticket_medio_cents == null ? '-' : brl(d.ticket_medio_cents, 0)}</p>
              <p className="text-xs text-muted-foreground">{d.faturamento_cents > 0 ? `${brl(d.faturamento_cents, 0)} em ${vf} ${vf === 1 ? 'venda' : 'vendas'}` : 'sem vendas com valor no período'}</p>
            </div>
          </div>

          {(d.sem_resultado ?? 0) > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-5 py-4 text-sm">
              <p className="font-semibold text-foreground">{d.sem_resultado} {d.sem_resultado === 1 ? 'reunião já passou' : 'reuniões já passaram'} sem o resultado marcado no CRM</p>
              <p className="mt-0.5 text-muted-foreground">Marque cada uma como realizada ou no-show. Enquanto isso, as reuniões efetivadas e as taxas de efetivação e de fechamento ficam abaixo ou acima da realidade.</p>
            </div>
          )}

          <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
            <section className={cn(CARD, 'flex min-w-0 flex-[1.6] flex-col gap-5 px-7 py-7')}>
              <div className="flex flex-col gap-1"><h2 className="text-xl font-semibold text-foreground">Taxas do funil</h2><p className="text-sm text-muted-foreground">Quanto de cada etapa avança para a próxima</p></div>
              <div className="grid gap-4 md:grid-cols-3">
                {rates.map((r) => (
                  <div key={r.label} className={cn('flex flex-col gap-2.5 rounded-xl border px-5 py-4', r.hi ? 'border-[#1E6B47] bg-accent' : 'border-border bg-muted')}>
                    <p className="text-[13px] text-foreground/85">{r.label}</p>
                    <p className={cn('text-[32px] font-semibold leading-9 tracking-tight', r.tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{r.v == null ? '-' : `${r.v}%`}</p>
                    <Bar value={r.v ?? 0} tone={r.tone} />
                    <p className="text-xs text-muted-foreground">{r.note}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={cn(CARD, 'flex min-w-0 flex-1 flex-col gap-4 px-7 py-7')}>
              <div className="flex flex-col gap-1"><h2 className="text-xl font-semibold text-foreground">O norte do funil</h2><p className="text-sm text-muted-foreground">A cada quantas, uma avança</p></div>
              {[
                { n: north(ratio(ch, ag)), t: 'conversas geram', s: '1 reunião marcada', hi: false },
                { n: north(ratio(re, vf)), t: 'reuniões efetivadas geram', s: '1 venda', hi: false },
                { n: north(ratio(ch, vf)), t: 'conversas geram', s: '1 venda', hi: true },
              ].map((x, i) => (
                <div key={i} className={cn('flex flex-1 items-center gap-6 rounded-xl border px-6 py-4', x.hi ? 'border-[#1E6B47] bg-accent' : 'border-border bg-muted')}>
                  <span className="w-20 shrink-0 text-[34px] font-semibold leading-10 tracking-tight text-foreground">{x.n}</span>
                  <span className="flex flex-col"><span className="text-[15px] font-semibold text-foreground">{x.t}</span><span className={cn('text-sm', LIME)}>{x.s}</span></span>
                </div>
              ))}
            </section>
          </div>

          {origem === 'inbound' && (
            <section className={cn(CARD, 'flex flex-col gap-5 px-7 py-7')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1"><h2 className="text-xl font-semibold text-foreground">Custos e retorno</h2><p className="text-sm text-muted-foreground">Gasto de anúncio da conta da Meta. Só aparece em Inbound.</p></div>
                {!!d.gasto_trafego_cents && <span className="rounded-full border border-border bg-muted px-4 py-2 text-sm text-muted-foreground">Investido <b className="ml-1 text-foreground">{brl(d.gasto_trafego_cents)}</b></span>}
              </div>
              {!d.gasto_trafego_cents ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-5 py-4 text-sm">
                  <p className="font-semibold text-foreground">Sem gasto de tráfego sincronizado</p>
                  <p className="mt-0.5 text-muted-foreground">Conecte a conta de anúncio da Meta em Automações, SDR, Conexões para ver custo por reunião, CAC e ROAS aqui.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {[
                      { t: 'Custo por lead (CPL)', v: brl(d.cpl_cents), s: `Gasto ÷ ${ch} conversas`, hi: false },
                      { t: 'Custo por reunião agendada', v: brl(d.custo_por_agendada_cents), s: `Gasto ÷ ${ag} reuniões`, hi: false },
                      { t: 'Custo por reunião realizada', v: brl(d.custo_por_realizada_cents), s: `Gasto ÷ ${re} reuniões`, hi: false },
                      { t: 'CAC', v: brl(d.cac_cents), s: `Gasto ÷ ${vf} vendas`, hi: true },
                      { t: 'ROAS', v: d.roas == null ? '-' : `${d.roas.toLocaleString('pt-BR')}x`, s: `${brl(d.faturamento_cents, 0)} ÷ gasto`, hi: true },
                    ].map((c) => (
                      <div key={c.t} className={cn('flex flex-col gap-1.5 rounded-xl border px-5 py-4', c.hi ? 'border-[#1E6B47] bg-accent' : 'border-border bg-muted')}>
                        <p className="text-[13px] text-foreground/85">{c.t}</p>
                        <p className={cn('text-[26px] font-semibold leading-8 tracking-tight', c.t === 'ROAS' ? LIME : 'text-foreground')}>{c.v}</p>
                        <p className="text-xs text-muted-foreground">{c.s}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[13px] text-muted-foreground">CAC e ROAS supõem que as {vf} vendas vieram do anúncio, porque o lead ainda não guarda o anúncio de origem. O CAC conta só mídia.</p>
                </>
              )}
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <section className={cn(CARD, 'flex flex-col gap-4 px-7 py-7')}>
              <div className="flex flex-col gap-1"><h2 className="text-xl font-semibold text-foreground">Velocidade da venda</h2><p className="text-sm text-muted-foreground">Quantos dias cada passo leva, em média</p></div>
              {[
                { t: 'Contato até a reunião', v: d.velocidade.contato_reuniao_dias, hi: false },
                { t: 'Reunião até o fechamento', v: d.velocidade.reuniao_fechamento_dias, hi: false },
                { t: 'Lead até a venda', v: d.velocidade.lead_venda_dias, hi: true },
              ].map((r) => (
                <div key={r.t} className={cn('flex items-center justify-between rounded-xl border px-5 py-3.5', r.hi ? 'border-[#1E6B47] bg-accent' : 'border-border bg-muted')}>
                  <span className="text-[15px] text-foreground">{r.t}</span>
                  <span className={cn('text-xl font-semibold', r.hi ? LIME : 'text-foreground')}>{r.v == null ? 'sem dado' : `${r.v.toLocaleString('pt-BR')} ${r.v === 1 ? 'dia' : 'dias'}`}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{d.velocidade.amostra_reunioes < 20 || d.velocidade.amostra_vendas < 20 ? 'Amostra pequena: ' : ''}{d.velocidade.amostra_reunioes} reuniões e {d.velocidade.amostra_vendas} vendas registradas.</p>
            </section>

            <section className={cn(CARD, 'flex flex-col gap-4 px-7 py-7')}>
              <div className="flex flex-col gap-1"><h2 className="text-xl font-semibold text-foreground">Reuniões sem resultado</h2><p className="text-sm text-muted-foreground">As taxas dependem de marcar o que aconteceu</p></div>
              {d.sem_resultado > 0 ? (
                <div className="flex items-center gap-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-6 py-5">
                  <span className="text-[40px] font-semibold leading-none text-amber-600 dark:text-[#F5B544]">{d.sem_resultado}</span>
                  <span className="flex flex-col"><span className="text-[15px] font-semibold text-foreground">reuniões seguem como agendada</span><span className="text-sm text-muted-foreground">Marque realizada, no-show ou cancelada</span></span>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted px-6 py-5 text-[15px] text-muted-foreground">Nenhuma reunião pendente de resultado.</div>
              )}
              <div className="mt-auto"><Button variant="secondary" className="h-11 px-6" asChild><Link href="/crm?view=table">Ver reuniões</Link></Button></div>
            </section>

            <section className={cn(CARD, 'flex flex-col gap-4 px-7 py-7')}>
              <div className="flex flex-col gap-1"><h2 className="text-xl font-semibold text-foreground">Motivos de perda</h2><p className="text-sm text-muted-foreground">Por que os leads saíram do funil</p></div>
              <p className="flex items-baseline gap-2.5"><span className="text-[40px] font-semibold leading-none tracking-tight text-foreground">{d.perdidos.total}</span><span className="text-[15px] text-muted-foreground">leads perdidos</span></p>
              {d.perdidos.motivos.length === 0 ? (
                <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border px-5 py-4">
                  <p className="text-[15px] font-semibold text-foreground">Nenhum com motivo registrado</p>
                  <p className="text-[13px] leading-normal text-muted-foreground">Quando o motivo for preenchido, esta área mostra os principais, como preço, sem retorno ou concorrente.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {d.perdidos.motivos.map((m) => (
                    <li key={m.motivo} className="flex items-center justify-between rounded-xl border border-border bg-muted px-4 py-3 text-[15px]"><span className="truncate text-foreground">{m.motivo}</span><span className="ml-3 font-semibold tabular-nums text-foreground">{m.count}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
