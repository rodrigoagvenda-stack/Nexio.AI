'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, Info, Loader2 } from 'lucide-react';
import { ymd } from '@/lib/utils/ymd';

interface Ad { ad_id: string; ad_name: string | null; campaign_name: string | null; spend_cents: number; conversations: number; customers: number }

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AdRanking({ since, until }: { since?: Date; until?: Date }) {
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!since || !until) return;
    setLoading(true);
    fetch(`/api/reports/cac?since=${ymd(since)}&until=${ymd(until)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setAds(d?.ads ?? []); setNote(d?.note ?? null); })
      .catch(() => setAds([]))
      .finally(() => setLoading(false));
  }, [since, until]);

  const withConv = (ads ?? []).filter((a) => a.conversations > 0).sort((a, b) => b.conversations - a.conversations).slice(0, 6);
  const max = Math.max(1, ...withConv.map((a) => a.conversations));
  const noConv = (ads ?? []).filter((a) => a.conversations === 0 && a.spend_cents > 0);
  const noConvSpend = noConv.reduce((s, a) => s + a.spend_cents, 0);
  const sold = (ads ?? []).some((a) => a.customers > 0);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-[14px] border border-border bg-card px-6 py-6">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#01573C]/10 dark:bg-[#96F63C]/[0.12]"><BarChart2 className="h-5 w-5 text-[#01573C] dark:text-[#96F63C]" /></span>
        <div className="flex flex-col gap-0.5"><h3 className="text-xl font-semibold text-foreground">Anúncios que trazem conversa</h3><p className="text-[13px] text-muted-foreground">Conversas que chegaram ao Zaapply por anúncio, no período</p></div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : withConv.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{note ?? 'Nenhum anúncio trouxe conversa neste período.'}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {withConv.map((a, i) => (
            <div key={a.ad_id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3"><span className="truncate text-sm font-semibold text-foreground">{a.ad_name ?? a.campaign_name ?? 'Anúncio'}</span><span className="shrink-0 text-[13px] text-[#01573C] dark:text-[#96F63C]">{brl(Math.round(a.spend_cents / a.conversations))} por conversa</span></div>
              <div className="flex items-center gap-3"><div className={i === 0 ? 'h-3.5 rounded-md bg-[#01573C] dark:bg-[#5BBE7E]' : 'h-3.5 rounded-md bg-[#01573C]/60 dark:bg-[#1F5A3D]'} style={{ width: `${Math.max(3, Math.round((a.conversations / max) * 78))}%` }} /><span className="text-sm font-semibold text-foreground">{a.conversations}</span></div>
            </div>
          ))}
        </div>
      )}

      {noConv.length > 0 && <p className="text-[13px] leading-[150%] text-muted-foreground">{noConv.length === 1 ? `${noConv[0].ad_name ?? 'Um anúncio'}: ${brl(noConv[0].spend_cents)} e 0 conversas.` : `${noConv.length} anúncios gastaram ${brl(noConvSpend)} e trouxeram 0 conversas.`} Pode ser campanha que não leva ao WhatsApp.</p>}
      {!loading && !sold && withConv.length > 0 && (
        <p className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground"><Info className="h-4 w-4 shrink-0" />Nenhum lead desses anúncios virou venda no período.</p>
      )}
      {!loading && (ads ?? []).length === 0 && (
        <Link href="/configuracoes/sdr?tab=conexoes&sub=metaads" className="text-center text-sm font-semibold text-[#01573C] hover:underline dark:text-[#96F63C]">Conectar a conta de anúncios</Link>
      )}
    </section>
  );
}
