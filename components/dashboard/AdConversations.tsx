'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, ArrowRight, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ymd } from '@/lib/utils/ymd';

interface Stage { key: string; label: string; count: number }
interface Depth { total: number; lead_2: number; lead_3: number; lead_5: number; lead_10: number }
interface Resp {
  stages: Stage[]
  total_spend_cents?: number
  conversation_spend_cents?: number
  other_spend_cents?: number
  link_clicks?: number
  depth?: Depth | null
  note?: string
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const n = (v: number) => v.toLocaleString('pt-BR');
const dm = (d?: Date) => (d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Connector({ label }: { label: string }) {
  return (
    <div className="hidden flex-col items-center justify-center gap-2 px-2 lg:flex">
      <span className="whitespace-nowrap rounded-full bg-[#F5B544]/[0.16] px-3 py-1 text-xs font-semibold text-[#8A5A00] dark:text-[#F5B544]">{label}</span>
      <ArrowRight className="h-5 w-8 text-muted-foreground/60" />
    </div>
  );
}

export function AdConversations({ since, until }: { since?: Date; until?: Date }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!since || !until) return;
    setLoading(true);
    const q = new URLSearchParams({ since: ymd(since), until: ymd(until) });
    fetch(`/api/reports/message-funnel?${q}`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [since, until]);

  const stages = data?.stages ?? [];
  const get = (k: string) => stages.find((s) => s.key === k);
  const started = get('conversas_iniciadas')?.count ?? 0;
  const replied = get('primeira_resposta')?.count ?? 0;
  const linkClicks = data?.link_clicks ?? 0;
  const spend = data?.total_spend_cents ?? 0;
  const convSpend = data?.conversation_spend_cents ?? 0;
  const otherSpend = data?.other_spend_cents ?? 0;
  const depth = data?.depth && data.depth.total > 0 ? data.depth : null;
  const has = stages.some((s) => s.count > 0) || spend > 0;
  const card = 'flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-6 py-5 dark:bg-[#141414]';
  const cap = 'text-xs font-semibold tracking-[0.1em] text-muted-foreground';
  const bars = depth ? [
    { label: 'Conversas do anúncio', v: depth.total },
    { label: '2 ou mais respostas', v: depth.lead_2 },
    { label: '3 ou mais', v: depth.lead_3 },
    { label: '5 ou mais', v: depth.lead_5 },
    { label: '10 ou mais', v: depth.lead_10 },
  ] : [];

  return (
    <section className="flex h-full flex-col gap-5 rounded-[14px] border border-border bg-card px-7 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#01573C]/10 dark:bg-[#96F63C]/[0.12]"><MessageCircle className="h-5 w-5 text-[#01573C] dark:text-[#96F63C]" /></span>
          <div className="flex flex-col gap-0.5"><h3 className="text-xl font-semibold text-foreground">Conversas do anúncio</h3><p className="text-[13px] text-muted-foreground">Gasto e cliques vêm da conta de anúncio da Meta, de {dm(since)} a {dm(until)}</p></div>
        </div>
        {has && spend > 0 && <span className="flex items-center gap-2.5 rounded-full bg-muted px-4 py-2 text-[13px] text-muted-foreground dark:bg-[#181818]">Investido <span className="text-[15px] font-semibold text-foreground">{brl(spend)}</span></span>}
      </div>

      {loading ? (
        <div className="flex h-56 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : !has ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <MessageCircle className="h-9 w-9 text-muted-foreground/30" />
          <p className="max-w-md text-sm text-muted-foreground">{data?.note ?? 'Sem dados de anúncio sincronizados neste período.'}</p>
          <Link href="/configuracoes/sdr?tab=conexoes&sub=metaads" className="flex items-center gap-1 text-sm font-semibold text-[#01573C] hover:underline dark:text-[#96F63C]">Conectar a conta de anúncios <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
            <div className={card}><span className={cap}>CLIQUES NO LINK DO ANÚNCIO</span><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{n(linkClicks)}</span><span className="text-[13px] text-muted-foreground">{linkClicks > 0 && convSpend > 0 ? `${brl(Math.round(convSpend / linkClicks))} por clique` : 'Sem cliques no período'}</span></div>
            <Connector label={`${pct(started, linkClicks)}% viram conversa`} />
            <div className={card}><span className={cap}>CONVERSAS INICIADAS</span><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{n(started)}</span><span className="text-[13px] text-muted-foreground">{started > 0 && convSpend > 0 ? `${brl(Math.round(convSpend / started))} por conversa` : 'Nenhuma conversa iniciada'}</span></div>
            <Connector label={`${pct(replied, started)}% respondidas`} />
            <div className={cn(card, 'border-[#01573C]/30 bg-[#E4F1E9] dark:border-[#96F63C]/25 dark:bg-[#12301F]')}><span className="text-xs font-semibold tracking-[0.1em] text-[#01573C] dark:text-[#96F63C]">PRIMEIRA RESPOSTA</span><span className="text-[40px] font-semibold leading-[44px] tracking-tight text-foreground">{n(replied)}</span><span className="text-[13px] text-foreground/80">{started > 0 ? `${n(replied)} de ${n(started)} conversas respondidas pela empresa, segundo a Meta` : 'Sem conversas para responder'}</span></div>
          </div>

          {otherSpend > 0 && (
            <p className="flex items-start gap-2.5 text-[13px] leading-[150%] text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" />{brl(otherSpend)} do investimento foram para campanhas que não levam ao WhatsApp (como visitas ao perfil). Esse valor entra em Investido, mas fica fora do custo por clique e por conversa.</p>
          )}

          {depth && (
            <div className="grid flex-1 gap-6 rounded-xl border border-border bg-muted/40 px-7 py-6 dark:bg-[#141414] lg:grid-cols-[1fr_1.6fr]">
              <div className="flex flex-col gap-2"><span className={cap}>QUALIDADE DAS CONVERSAS</span><p className="text-xl font-semibold text-foreground">Quanto o lead conversa depois de entrar</p><p className="text-[13px] leading-[150%] text-muted-foreground">Conta conversas do anúncio em que o lead respondeu várias vezes. Medido no Zaapply, conversa por conversa. Quanto mais respostas, mais interesse real no que você vende.</p></div>
              <div className="flex items-end justify-around gap-3 pt-4">
                {bars.map((b, i) => (
                  <div key={b.label} className="flex flex-col items-center gap-2">
                    <span className="text-xl font-semibold text-foreground">{n(b.v)}</span>
                    <span className="text-xs font-semibold text-[#01573C] dark:text-[#96F63C]">{i === 0 ? '100%' : `${pct(b.v, depth.total)}%`}</span>
                    <div className={cn('w-14 rounded-t-md', i === 0 ? 'bg-[#01573C] dark:bg-[#5BBE7E]' : 'bg-[#01573C]/70 dark:bg-[#1F5A3D]')} style={{ height: Math.max(8, Math.round((b.v / Math.max(1, depth.total)) * 120)) }} />
                    <span className="max-w-[88px] text-center text-[13px] leading-tight text-muted-foreground">{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
