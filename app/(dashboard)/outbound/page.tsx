'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { AutomationsNav } from '@/components/automacoes/AutomationsNav';
import { useUser } from '@/lib/hooks/useUser';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  lead_id?: number;
  created_at: string;
  tentativas?: number | null;
  total_erros?: number | null;
  respondeu_em?: string | null;
  resposta_bot?: boolean | null;
  converteu_em?: string | null;
  ultima_abordagem?: string | null;
  proximo_contato_em?: string | null;
  numero_bloqueado?: boolean | null;
  lead?: { contact_name?: string | null; company_name?: string | null; whatsapp?: string | null } | null;
}

interface Template {
  id: number;
  company_id?: number | null;
  categoria: string;
  prompt_sistema?: string | null;
  ativo: boolean;
  usar_ia?: boolean | null;
}

interface OutboundLimit { mensagens_enviadas_hoje?: number; limite_diario?: number | null }

type Sub = 'abordagens' | 'mensagens' | 'limites';
type Situation = 'pessoa' | 'auto' | 'sem';
type Filter = 'todos' | Situation;

const CARD = 'rounded-[14px] border border-border bg-card';
const LIME = 'text-[#01573C] dark:text-[#96F63C]';
const PILL3D = 'flex h-11 items-center justify-center rounded-full bg-[#141414] px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF14,0_3px_0_#000000] transition-transform active:translate-y-px disabled:opacity-60';
const PILL_GREEN = 'flex h-11 items-center justify-center rounded-full bg-[#01573C] px-6 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF26,0_3px_0_#003526] transition-transform active:translate-y-px disabled:opacity-60';
const PER_PAGE = 7;

const SITUATION_LABEL: Record<Situation, string> = { pessoa: 'Pessoa respondeu', auto: 'Resposta automática', sem: 'Sem resposta' };
const CATEGORY_LABEL: Record<string, string> = { primeira_abordagem: 'Primeira abordagem', follow_up: 'Segundo toque', aberturas: 'Aberturas' };

const situationOf = (c: Campaign): Situation => (c.respondeu_em ? (c.resposta_bot ? 'auto' : 'pessoa') : 'sem');
const dm = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '');
const dmHm = (iso?: string | null) => (iso ? `${dm(iso)} ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? (c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' '));
const leadName = (c: Campaign) => c.lead?.contact_name || c.lead?.company_name || `Lead ${c.lead_id ?? c.id}`;

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('flex h-[26px] w-[46px] shrink-0 items-center rounded-full px-[3px] transition-colors disabled:opacity-60', on ? 'justify-end bg-[#01573C]' : 'justify-start bg-muted-foreground/30 dark:bg-[#2A2A2A]')}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OutboundPage() {
  const router = useRouter();
  const { company, loading: loadingCompany } = useUser();

  const [sub, setSub] = useState<Sub>('abordagens');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [limits, setLimits] = useState<OutboundLimit>({});
  const [paused, setPaused] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [toggling, setToggling] = useState(false);

  const [filter, setFilter] = useState<Filter>('todos');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [tplId, setTplId] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ text: string; ativo: boolean; usar_ia: boolean } | null>(null);
  const [savingTpl, setSavingTpl] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newDraft, setNewDraft] = useState({ nome: '', texto: '' });
  const [creating, setCreating] = useState(false);

  const [limitInput, setLimitInput] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch('/api/outbound/campaigns');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setCampaigns(json.campaigns ?? []);
    } catch (e) {
      console.error('fetchCampaigns', e);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/outbound/templates');
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setTemplates(json.templates ?? []);
    } catch (e) {
      console.error('fetchTemplates', e);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const fetchLimits = useCallback(async () => {
    try {
      const res = await fetch('/api/outbound/limits');
      const json = await res.json();
      if (res.ok && json.success && json.limits) {
        setLimits(json.limits);
        setLimitInput(json.limits.limite_diario != null ? String(json.limits.limite_diario) : '');
      }
    } catch (e) {
      console.error('fetchLimits', e);
    }
  }, []);

  useEffect(() => {
    if (!company?.id) return;
    void fetchCampaigns();
    void fetchTemplates();
    void fetchLimits();
    fetch('/api/outbound/pause').then((r) => r.json()).then((j) => { if (j.success) setPaused(!!j.pausado); }).catch(() => {});
  }, [company?.id, fetchCampaigns, fetchTemplates, fetchLimits]);

  // Modelo aberto no editor: o primeiro (primeira abordagem, se existir) até a pessoa escolher outro
  useEffect(() => {
    if (templates.length === 0) { setTplId(null); return; }
    setTplId((cur) => (cur && templates.some((t) => t.id === cur) ? cur : (templates.find((t) => t.categoria === 'primeira_abordagem') ?? templates[0]).id));
  }, [templates]);
  const tpl = templates.find((t) => t.id === tplId) ?? null;
  useEffect(() => {
    setDraft(tpl ? { text: tpl.prompt_sistema ?? '', ativo: tpl.ativo, usar_ia: tpl.usar_ia ?? true } : null);
  }, [tpl?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { todos: campaigns.length, pessoa: 0, auto: 0, sem: 0 };
    campaigns.forEach((x) => { c[situationOf(x)]++; });
    return c;
  }, [campaigns]);
  const rows = useMemo(() => campaigns.filter((c) => filter === 'todos' || situationOf(c) === filter), [campaigns, filter]);
  const pageRows = rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const selected = campaigns.find((c) => c.id === selectedId) ?? pageRows[0] ?? null;
  useEffect(() => { setPage(0); }, [filter]);

  const now = Date.now();
  const converted = campaigns.filter((c) => c.converteu_em).length;
  const overdue = campaigns.filter((c) => c.proximo_contato_em && new Date(c.proximo_contato_em).getTime() < now && !c.numero_bloqueado);
  const overdueDates = overdue.map((c) => new Date(c.proximo_contato_em as string).getTime());
  const lastSend = campaigns.map((c) => c.ultima_abordagem).filter(Boolean).sort().at(-1) ?? null;
  const firstApproach = campaigns.map((c) => c.created_at).sort()[0] ?? null;
  const abordados = new Set(campaigns.filter((c) => (c.tentativas ?? 0) > 0).map((c) => c.lead_id ?? c.id)).size;
  const blocked = new Set(campaigns.filter((c) => c.numero_bloqueado).map((c) => c.lead?.whatsapp ?? c.lead_id ?? c.id)).size;
  const sentToday = limits.mensagens_enviadas_hoje ?? 0;
  const dailyLimit = limits.limite_diario ?? null;

  async function togglePause() {
    const next = !paused;
    setToggling(true);
    try {
      const res = await fetch('/api/outbound/pause', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pausado: next }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setPaused(next);
      toast({ title: next ? 'Outbound pausado' : 'Outbound ligado', variant: 'success' });
    } catch (e) {
      toast({ title: 'Não foi possível alterar o Outbound', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  }

  async function markClient(c: Campaign) {
    const stamp = new Date().toISOString();
    try {
      const res = await fetch(`/api/outbound/campaigns/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ converteu_em: stamp }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error();
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, converteu_em: stamp } : x)));
      toast({ title: 'Lead marcado como cliente', variant: 'success' });
    } catch {
      toast({ title: 'Não foi possível marcar como cliente', variant: 'destructive' });
    }
  }

  async function saveTemplate() {
    if (!tpl || !draft) return;
    setSavingTpl(true);
    try {
      const res = await fetch(`/api/outbound/templates/${tpl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt_sistema: draft.text, ativo: draft.ativo, usar_ia: draft.usar_ia }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error();
      setTemplates((prev) => prev.map((t) => (t.id === tpl.id ? { ...t, prompt_sistema: draft.text, ativo: draft.ativo, usar_ia: draft.usar_ia } : t)));
      toast({ title: 'Mensagem salva', variant: 'success' });
    } catch {
      toast({ title: 'Não foi possível salvar a mensagem', variant: 'destructive' });
    } finally {
      setSavingTpl(false);
    }
  }

  async function createTemplate() {
    if (!newDraft.nome.trim() || !newDraft.texto.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/outbound/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoria: newDraft.nome.trim(), prompt_sistema: newDraft.texto.trim(), usar_ia: false }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error();
      setTemplates((prev) => [...prev, json.template]);
      setTplId(json.template.id);
      setNewOpen(false);
      setNewDraft({ nome: '', texto: '' });
      toast({ title: 'Modelo criado', variant: 'success' });
    } catch {
      toast({ title: 'Não foi possível criar o modelo', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function deleteTemplate() {
    if (!tpl || !window.confirm('Excluir este modelo? Essa ação não pode ser desfeita.')) return;
    const res = await fetch(`/api/outbound/templates/${tpl.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) { toast({ title: 'Não foi possível excluir o modelo', variant: 'destructive' }); return; }
    setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
    toast({ title: 'Modelo excluído', variant: 'success' });
  }

  async function saveLimit() {
    const n = Number(limitInput);
    if (!Number.isFinite(n) || n < 1 || n > 1000) { toast({ title: 'Informe um limite entre 1 e 1000', variant: 'warning' }); return; }
    setSavingLimit(true);
    try {
      const res = await fetch('/api/outbound/limits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ company_id: company?.id, limite_diario: n }) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message); }
      await fetchLimits();
      toast({ title: 'Limite salvo', variant: 'success' });
    } catch (e) {
      toast({ title: 'Não foi possível salvar o limite', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setSavingLimit(false);
    }
  }

  if (!loadingCompany && company && !company.features?.outbound) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 py-16 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Recurso não disponível</h1>
        <p className="text-sm text-muted-foreground">O Outbound não está ativado na sua empresa. Fale com o time para habilitar.</p>
      </div>
    );
  }

  const exampleName = (campaigns.find((c) => c.lead?.contact_name)?.lead?.contact_name ?? 'Maria').trim().split(/\s+/)[0];
  const preview = (draft?.text ?? '').replace(/\{nome\}/gi, exampleName);

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <AutomationsNav active="outbound" />

      <nav aria-label="Outbound" className="flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-border bg-card p-1">
        {([['abordagens', 'Abordagens'], ['mensagens', 'Mensagens'], ['limites', 'Limites e horário']] as const).map(([id, label]) => (
          <button key={id} type="button" aria-current={sub === id ? 'page' : undefined} onClick={() => setSub(id)}
            className={cn('shrink-0 rounded-full px-5 py-2 text-sm transition-colors', sub === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </nav>

      {/* ─── Abordagens ─── */}
      {sub === 'abordagens' && (
        <>
          <div className={cn(CARD, 'flex flex-wrap items-center justify-between gap-4 px-7 py-6')}>
            <div className="flex items-start gap-4">
              <span className={cn('mt-2.5 h-3 w-3 shrink-0 rounded-full', paused ? 'bg-amber-500' : 'bg-[#01573C] dark:bg-[#96F63C]')} />
              <div className="flex flex-col gap-1">
                <h2 className="text-[22px] font-semibold leading-7 text-foreground">{paused ? 'Outbound pausado' : 'Outbound ligado'}</h2>
                <p className="text-[15px] text-muted-foreground">{paused ? 'Não envia mensagens até você ligar de novo.' : 'Envia a primeira mensagem para leads novos, de segunda a sexta, das 9h às 18h.'}</p>
              </div>
            </div>
            <button type="button" onClick={togglePause} disabled={toggling} className={PILL3D}>{paused ? 'Ligar outbound' : 'Pausar outbound'}</button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Leads abordados</p>
              <p className="text-[40px] font-semibold leading-[46px] tracking-tight text-foreground">{abordados}</p>
              <p className="text-sm text-muted-foreground">{firstApproach ? `desde ${dm(firstApproach)}` : 'nenhum ainda'}</p>
            </div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Responderam</p>
              <p className={cn('text-[40px] font-semibold leading-[46px] tracking-tight', LIME)}>{counts.pessoa + counts.auto}</p>
              <p className="text-sm text-muted-foreground">{plural(counts.pessoa, 'pessoa', 'pessoas')} e {plural(counts.auto, 'resposta automática', 'respostas automáticas')}</p>
            </div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Viraram cliente</p>
              <p className="text-[40px] font-semibold leading-[46px] tracking-tight text-foreground">{converted}</p>
              <p className="text-sm text-muted-foreground">marcados como convertidos</p>
            </div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
              <p className="text-[15px] text-foreground/85">Enviadas hoje</p>
              <p className="text-[40px] font-semibold leading-[46px] tracking-tight text-muted-foreground"><span className="text-foreground">{sentToday}</span> {dailyLimit != null ? `de ${dailyLimit}` : ''}</p>
              <p className="text-sm text-muted-foreground">{lastSend ? `Último envio em ${dm(lastSend)}` : 'Nenhum envio ainda'}</p>
            </div>
          </div>

          {overdue.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#F5B544]/35 bg-[#F5B544]/[0.08] px-6 py-4">
              <div className="flex items-center gap-4">
                <Clock className="h-[22px] w-[22px] shrink-0 text-[#F5B544]" />
                <div className="flex flex-col gap-1">
                  <p className="text-base font-semibold leading-5 text-foreground">{plural(overdue.length, 'lead está', 'leads estão')} com o próximo contato vencido</p>
                  <p className="text-sm text-[#8A6A1F] dark:text-[#C9B27A]">
                    {overdue.length === 1 ? `O prazo era ${dm(new Date(overdueDates[0]).toISOString())}.` : `Os prazos eram de ${dm(new Date(Math.min(...overdueDates)).toISOString())} a ${dm(new Date(Math.max(...overdueDates)).toISOString())}.`} O Outbound envia só a primeira mensagem, o segundo toque vem de uma sequência.
                  </p>
                </div>
              </div>
              <Link href="/configuracoes/follow" className={PILL_GREEN}>Ver sequência do segundo toque</Link>
            </div>
          )}

          <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
            <section className={cn(CARD, 'flex min-w-0 flex-1 flex-col gap-4 px-7 py-6')}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[22px] font-semibold text-foreground">Leads abordados</h3>
                <div className="flex flex-wrap items-center gap-2">
                  {([['todos', 'Todos'], ['pessoa', 'Pessoa respondeu'], ['auto', 'Resposta automática'], ['sem', 'Sem resposta']] as const).map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
                      className={cn('rounded-full px-4 py-2 text-sm transition-colors', filter === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                      {label} {counts[id]}
                    </button>
                  ))}
                </div>
              </div>

              {loadingCampaigns ? (
                <div className="flex h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : rows.length === 0 ? (
                <p className="py-16 text-center text-[15px] text-muted-foreground">{campaigns.length === 0 ? 'O Outbound ainda não abordou nenhum lead.' : 'Nenhum lead nesta situação.'}</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse">
                      <thead>
                        <tr className="text-left text-[13px] tracking-[0.06em] text-muted-foreground">
                          <th className="px-4 py-3 font-medium">LEAD</th><th className="py-3 font-medium">SITUAÇÃO</th><th className="py-3 font-medium">ABORDADO EM</th><th className="px-4 py-3 font-medium">PRÓXIMO TOQUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((c) => {
                          const sit = situationOf(c);
                          const late = !!c.proximo_contato_em && new Date(c.proximo_contato_em).getTime() < now;
                          const isSel = selected?.id === c.id;
                          return (
                            <tr key={c.id} onClick={() => setSelectedId(c.id)} className={cn('cursor-pointer border-t border-border transition-colors', isSel ? 'bg-[#E4F1E9] dark:bg-[#12301F]' : 'hover:bg-muted')}>
                              <td className="max-w-[360px] truncate px-4 py-4 text-[15px] font-semibold text-foreground">{leadName(c)}</td>
                              <td className={cn('py-4 text-sm', c.converteu_em ? cn('font-semibold', LIME) : sit === 'pessoa' ? LIME : 'text-muted-foreground')}>{c.converteu_em ? 'Virou cliente' : SITUATION_LABEL[sit]}</td>
                              <td className="whitespace-nowrap py-4 text-sm tabular-nums text-foreground/85">{dmHm(c.ultima_abordagem ?? c.created_at)}</td>
                              <td className={cn('whitespace-nowrap px-4 py-4 text-sm tabular-nums', late ? 'font-medium text-amber-600 dark:text-[#F5B544]' : 'text-foreground/85')}>{c.proximo_contato_em ? `${dm(c.proximo_contato_em)}${late ? ' atrasado' : ''}` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-sm text-muted-foreground">{page * PER_PAGE + 1} a {Math.min((page + 1) * PER_PAGE, rows.length)} de {plural(rows.length, 'lead', 'leads')}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground transition-colors enabled:hover:text-foreground disabled:opacity-50">Anterior</button>
                      <button type="button" disabled={(page + 1) * PER_PAGE >= rows.length} onClick={() => setPage((p) => p + 1)} className="rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors enabled:hover:bg-accent disabled:opacity-50">Próxima</button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <aside className={cn(CARD, 'flex w-full shrink-0 flex-col gap-5 px-7 py-6 xl:w-[430px]')}>
              {selected ? (
                <>
                  <div className="flex flex-col gap-3">
                    <h3 className="text-[22px] font-semibold leading-7 text-foreground">{leadName(selected)}</h3>
                    <span className={cn('w-fit rounded-full px-3 py-1 text-[13px] font-semibold', selected.converteu_em || situationOf(selected) === 'pessoa' ? 'bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]' : 'bg-muted text-muted-foreground')}>
                      {selected.converteu_em ? 'Virou cliente' : SITUATION_LABEL[situationOf(selected)]}
                    </span>
                  </div>
                  <dl className="flex flex-col rounded-xl border border-border bg-muted/60 dark:bg-[#181818]">
                    {[
                      ['Primeira mensagem enviada', dmHm(selected.ultima_abordagem ?? selected.created_at).replace(' ', ' às '), false],
                      ['Tentativas', String(selected.tentativas ?? 0), false],
                      ['Próximo contato', selected.proximo_contato_em ? `${dm(selected.proximo_contato_em)}${new Date(selected.proximo_contato_em).getTime() < now ? ', atrasado' : ''}` : '—', !!selected.proximo_contato_em && new Date(selected.proximo_contato_em).getTime() < now],
                      ['Erros de envio', (selected.total_erros ?? 0) > 0 ? String(selected.total_erros) : 'Nenhum', false],
                    ].map(([k, v, warn], i) => (
                      <div key={k as string} className={cn('flex items-center justify-between gap-3 px-5 py-4 text-[15px]', i > 0 && 'border-t border-border')}>
                        <dt className="text-foreground/80">{k}</dt>
                        <dd className={cn('font-semibold', warn ? 'text-amber-600 dark:text-[#F5B544]' : 'text-foreground')}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-col gap-3">
                    <button type="button" disabled={!selected.lead?.whatsapp} onClick={() => router.push(`/atendimento?phone=${encodeURIComponent(selected.lead?.whatsapp ?? '')}`)} className={cn(PILL_GREEN, 'w-full')}>Abrir conversa</button>
                    <button type="button" disabled={!!selected.converteu_em} onClick={() => void markClient(selected)} className={cn(PILL3D, 'w-full')}>{selected.converteu_em ? 'Já é cliente' : 'Marcar como cliente'}</button>
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-[15px] text-muted-foreground">Escolha um lead na lista para ver os detalhes.</p>
              )}
            </aside>
          </div>
        </>
      )}

      {/* ─── Mensagens ─── */}
      {sub === 'mensagens' && (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
          <aside className={cn(CARD, 'flex w-full shrink-0 flex-col gap-4 p-6 xl:w-[380px]')}>
            <div className="flex flex-col gap-2">
              <h3 className="text-[22px] font-semibold text-foreground">Mensagens</h3>
              <p className="text-sm leading-[150%] text-muted-foreground">O texto que o Outbound envia para leads novos. Só a primeira mensagem sai daqui.</p>
            </div>
            {loadingTemplates ? (
              <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : templates.map((t) => (
              <button key={t.id} type="button" onClick={() => setTplId(t.id)}
                className={cn('flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors', t.id === tplId ? 'border-[#01573C]/30 bg-[#E4F1E9] dark:border-transparent dark:bg-[#12301F]' : 'border-border hover:bg-muted')}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold text-foreground">{categoryLabel(t.categoria)}</span>
                  <span className="text-[13px] text-muted-foreground">{t.usar_ia === false ? 'Texto fixo' : 'Escrita pela IA'}</span>
                </span>
                <span className="flex items-center gap-2 text-[13px] text-foreground/85"><span className={cn('h-2 w-2 rounded-full', t.ativo ? 'bg-[#01573C] dark:bg-[#96F63C]' : 'bg-muted-foreground/40')} />{t.ativo ? 'Ativa' : 'Desligada'}</span>
              </button>
            ))}
            <button type="button" onClick={() => setNewOpen(true)} className={cn(PILL3D, 'w-full')}>Novo modelo</button>
            <p className="text-[13px] leading-[150%] text-muted-foreground">Os toques seguintes, como lembrete e reengajamento, ficam em <Link href="/configuracoes/follow" className="underline underline-offset-2 hover:text-foreground">Sequências</Link>.</p>
          </aside>

          <section className={cn(CARD, 'flex min-w-0 flex-1 flex-col gap-5 px-8 py-7')}>
            {tpl && draft ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-[28px] font-semibold leading-8 tracking-tight text-foreground">{categoryLabel(tpl.categoria)}</h3>
                    <p className="text-[15px] text-muted-foreground">{tpl.categoria === 'primeira_abordagem' ? 'É a mensagem que o lead recebe quando o Outbound faz o primeiro contato.' : 'Mensagem enviada pelo Outbound neste modelo.'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3"><span className="text-[15px] text-foreground">{draft.ativo ? 'Ativa' : 'Desligada'}</span><Toggle on={draft.ativo} onChange={(v) => setDraft({ ...draft, ativo: v })} label="Ligar ou desligar este modelo" /></div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <label htmlFor="ob-texto" className="text-sm font-semibold text-foreground">Texto da mensagem</label>
                  <textarea id="ob-texto" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} rows={8}
                    className="w-full resize-y rounded-xl border border-border bg-muted px-5 py-4 text-base leading-[160%] text-foreground outline-none focus:border-[#01573C]/50 dark:border-[#2A2A2A] dark:bg-[#181818] dark:focus:border-[#96F63C]/40" />
                  <p className="text-[13px] text-muted-foreground">{draft.usar_ia ? 'A IA usa este texto como base e adapta para cada lead.' : '{nome} é trocado pelo nome do lead na hora do envio.'}</p>
                </div>
                <div className="flex items-center justify-between gap-6 rounded-xl border border-border bg-muted/60 px-6 py-5 dark:border-[#2A2A2A] dark:bg-[#181818]">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-base font-semibold text-foreground">Deixar a IA reescrever para cada lead</p>
                    <p className="text-sm leading-[150%] text-muted-foreground">Desligado, todo lead recebe o texto acima. Ligado, a IA adapta a mensagem ao perfil do lead no Google.</p>
                  </div>
                  <Toggle on={draft.usar_ia} onChange={(v) => setDraft({ ...draft, usar_ia: v })} label="Deixar a IA reescrever para cada lead" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={saveTemplate} disabled={savingTpl || !draft.text.trim()} className={PILL_GREEN}>{savingTpl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar mensagem'}</button>
                  <button type="button" onClick={() => setDraft({ text: tpl.prompt_sistema ?? '', ativo: tpl.ativo, usar_ia: tpl.usar_ia ?? true })} className={PILL3D}>Descartar</button>
                  {tpl.company_id != null && <button type="button" onClick={deleteTemplate} className="ml-auto text-sm font-medium text-destructive hover:underline">Excluir modelo</button>}
                </div>
              </>
            ) : (
              <p className="py-16 text-center text-[15px] text-muted-foreground">{loadingTemplates ? 'Carregando…' : 'Você ainda não tem nenhum modelo. Crie o primeiro em Novo modelo.'}</p>
            )}
          </section>

          <aside className={cn(CARD, 'flex w-full shrink-0 flex-col gap-4 p-6 xl:w-[400px]')}>
            <div className="flex flex-col gap-1.5">
              <h3 className="text-xl font-semibold text-foreground">Como o lead vê</h3>
              <p className="text-sm text-muted-foreground">Exemplo com o nome {exampleName}.</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-5 dark:border-[#1F1F1F] dark:bg-[#0F0F0F]">
              <div className="whitespace-pre-wrap rounded-xl rounded-tr-sm bg-[#DCF8C6] px-4 py-3.5 text-[15px] leading-[150%] text-[#0B2A1A] dark:bg-[#12301F] dark:text-[#F0F5F1]">{preview || 'Escreva o texto para ver a prévia.'}</div>
            </div>
            <p className="text-[13px] text-muted-foreground">Quem responde depois é o agente da aba SDR.</p>
          </aside>
        </div>
      )}

      {/* ─── Limites e horário ─── */}
      {sub === 'limites' && (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
              <div className="flex flex-col gap-2">
                <h3 className="text-[22px] font-semibold text-foreground">Quantas mensagens por dia</h3>
                <p className="text-[15px] text-muted-foreground">Quando chega no limite, o Outbound para e volta no dia seguinte.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <input aria-label="Mensagens por dia" inputMode="numeric" value={limitInput} onChange={(e) => setLimitInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="h-14 w-40 rounded-xl border border-border bg-muted px-5 text-[22px] font-semibold text-foreground outline-none focus:border-[#01573C]/50 dark:border-[#2A2A2A] dark:bg-[#181818] dark:focus:border-[#96F63C]/40" />
                <p className="text-[15px] text-muted-foreground">mensagens por dia. Hoje foram enviadas {sentToday}.</p>
              </div>
              <button type="button" onClick={saveLimit} disabled={savingLimit} className={cn(PILL_GREEN, 'w-fit')}>{savingLimit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar limite'}</button>
            </section>
            <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
              <div className="flex flex-col gap-2">
                <h3 className="text-[22px] font-semibold text-foreground">Quando o Outbound envia</h3>
                <p className="text-[15px] text-muted-foreground">De segunda a sexta, das 9h às 18h, no horário de Brasília. Fora disso ele fica em repouso.</p>
              </div>
              <p className="flex items-center gap-3 rounded-xl border border-border bg-muted/60 px-5 py-4 text-[15px] text-foreground/85 dark:border-[#2A2A2A] dark:bg-[#181818]"><Lock className="h-4 w-4 shrink-0 text-muted-foreground" />Esse horário é fixo e ainda não dá para mudar por aqui.</p>
            </section>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-6 xl:w-[620px]">
            <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
              <div className="flex flex-col gap-2">
                <h3 className="text-[22px] font-semibold text-foreground">Ritmo automático</h3>
                <p className="text-[15px] leading-[150%] text-muted-foreground">O Zaapply envia devagar, como uma pessoa faria, para o número não ser bloqueado.</p>
              </div>
              <dl className="flex flex-col rounded-xl border border-border bg-muted/60 dark:border-[#2A2A2A] dark:bg-[#181818]">
                {[['Intervalo entre mensagens', '45 a 135 segundos'], ['Pausa maior a cada 10 a 15 envios', '5 a 10 minutos'], ['Máximo por hora', '30 mensagens']].map(([k, v], i) => (
                  <div key={k} className={cn('flex items-center justify-between gap-3 px-5 py-4 text-[15px]', i > 0 && 'border-t border-border dark:border-[#262626]')}><dt className="text-foreground/80">{k}</dt><dd className="font-semibold text-foreground">{v}</dd></div>
                ))}
              </dl>
            </section>
            <section className={cn(CARD, 'flex flex-col gap-4 px-8 py-7')}>
              <h3 className="text-[22px] font-semibold text-foreground">Pediram para parar</h3>
              <p className="flex items-baseline gap-3"><span className="text-[40px] font-semibold leading-[46px] text-foreground">{blocked}</span><span className="text-[15px] text-foreground/85">{blocked === 1 ? 'número não recebe mais mensagens' : 'números não recebem mais mensagens'}</span></p>
              <p className="text-sm leading-[150%] text-muted-foreground">Quando um lead pede para não receber mais, o Zaapply bloqueia o número sozinho.</p>
            </section>
          </div>
        </div>
      )}

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo modelo</DialogTitle>
            <DialogDescription>Um texto fixo que o Outbound envia. Use {'{nome}'} para colocar o nome do lead.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><label htmlFor="nm-nome" className="text-sm font-semibold text-foreground">Nome do modelo</label>
              <input id="nm-nome" value={newDraft.nome} onChange={(e) => setNewDraft({ ...newDraft, nome: e.target.value })} placeholder="Ex: Oferta de diagnóstico" className="h-11 rounded-xl border border-border bg-muted px-4 text-sm text-foreground outline-none dark:border-[#2A2A2A] dark:bg-[#181818]" /></div>
            <div className="flex flex-col gap-2"><label htmlFor="nm-texto" className="text-sm font-semibold text-foreground">Texto da mensagem</label>
              <textarea id="nm-texto" rows={5} value={newDraft.texto} onChange={(e) => setNewDraft({ ...newDraft, texto: e.target.value })} className="rounded-xl border border-border bg-muted px-4 py-3 text-sm leading-[150%] text-foreground outline-none dark:border-[#2A2A2A] dark:bg-[#181818]" /></div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setNewOpen(false)} className={PILL3D}>Cancelar</button>
            <button type="button" onClick={createTemplate} disabled={creating || !newDraft.nome.trim() || !newDraft.texto.trim()} className={PILL_GREEN}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar modelo'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
