'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClosedLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  project_value: number;
  closed_at: string | null;
  updated_at: string;
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export function RecentSales() {
  const router = useRouter();
  const [leads, setLeads] = useState<ClosedLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userData } = await supabase.from('users').select('company_id').eq('auth_user_id', user.id).single();
        if (!userData?.company_id) return;
        const { data } = await supabase
          .from('leads')
          .select('id, company_name, contact_name, project_value, closed_at, updated_at')
          .eq('company_id', userData.company_id)
          .eq('status', 'Fechado')
          .order('closed_at', { ascending: false, nullsFirst: false })
          .limit(30);
        setLeads((data as ClosedLead[]) || []);
      } catch (e) {
        console.error('Error fetching closed leads:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = leads.reduce((s, l) => s + (l.project_value || 0), 0);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 rounded-[14px] border border-border bg-card px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-semibold text-foreground">Vendas recentes</h3>
          <p className="text-[13px] text-muted-foreground">Últimas vendas fechadas, da mais nova para a mais antiga</p>
        </div>
        {!loading && leads.length > 0 && (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-xl font-semibold text-[#01573C] dark:text-[#96F63C]">{formatCurrency(total)}</span>
            <span className="text-[13px] text-muted-foreground">{leads.length} {leads.length === 1 ? 'venda' : 'vendas'}</span>
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-xl bg-muted" />)
        ) : leads.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma venda fechada ainda.</p>
        ) : leads.map((l) => {
          const when = l.closed_at ?? l.updated_at;
          return (
            <button key={l.id} type="button" onClick={() => router.push('/crm')} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted dark:bg-[#181818] dark:hover:bg-[#1E1E1E]">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-semibold text-foreground">{l.contact_name || l.company_name}</span>
                <span className="truncate text-[13px] text-muted-foreground">Fechou em {shortDate(when)} · {formatDistanceToNowStrict(new Date(when), { addSuffix: true, locale: ptBR })}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[15px] font-semibold text-[#01573C] dark:text-[#96F63C]">{formatCurrency(l.project_value)}<ChevronRight className="h-4 w-4 text-muted-foreground" /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
