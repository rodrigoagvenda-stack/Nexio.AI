'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Info, Loader2, Lock } from 'lucide-react';
import { useUser } from '@/lib/hooks/useUser';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { CARD, CardTitle, FIELD, FieldLabel, LIME } from '@/components/configuracoes/cfg-ui';

const LEAD_LIMITS = [10, 25, 50, 100, 200, 500];
const ESTADOS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const NICHOS = [
  'Restaurantes', 'Academias', 'Salões de Beleza', 'Clínicas Médicas', 'Consultórios Odontológicos', 'Escritórios de Advocacia',
  'Imobiliárias', 'Agências de Marketing', 'Lojas de Roupas', 'Pet Shops', 'Oficinas Mecânicas', 'Escolas', 'Hotéis e Pousadas',
  'Bares e Cafeterias', 'Farmácias', 'Supermercados', 'Padarias', 'Floriculturas', 'Auto Escolas',
];
const MAPS_URL = /^https?:\/\/(www\.)?google\.com(\.br)?\/maps\//i;
const STAGE_COLORS = ['#8A8A8A', '#F5B544', '#5B9BF5', '#96F63C', '#4A4A4A', '#C084FC', '#F472B6'];
const RUNNING_MAX_MS = 15 * 60_000;

interface Session {
  id: string;
  requested: number;
  inserted: number;
  found: number;
  processed: number;
  status: 'running' | 'complete' | 'error' | string;
  created_at: string;
  segmento: string | null;
  cidade: string | null;
  uf: string | null;
  sem_telefone: number | null;
  sem_whatsapp: number | null;
}

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
const title = (s: Session) => (s.segmento || s.cidade ? `${s.segmento ?? 'Sem segmento'}${s.cidade ? `, ${s.cidade}${s.uf ? ` (${s.uf})` : ''}` : ''}` : 'Link do Google Maps, sem segmento');

const chip = (on: boolean) => cn('rounded-full border px-4 py-2 text-sm transition-colors', on ? 'border-[#1E6B47] bg-accent font-semibold text-foreground' : 'border-border bg-muted text-foreground hover:border-foreground/30');

export default function OrbitPage() {
  const { company, loading: userLoading } = useUser();
  const enabled = !!company?.features?.prospect;

  const [mode, setMode] = useState<'manual' | 'url'>('manual');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [nicho, setNicho] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customNicho, setCustomNicho] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [limit, setLimit] = useState(100);
  const [projectValue, setProjectValue] = useState('');
  const [starting, setStarting] = useState(false);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [leadStats, setLeadStats] = useState<{ total: number; quente: number; morno: number; frio: number; stages: { name: string; n: number }[] } | null>(null);
  const [running, setRunning] = useState<Session | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    if (!company?.id) return [] as Session[];
    const { data } = await createClient().from('extraction_sessions')
      .select('id, requested, inserted, found, processed, status, created_at, segmento, cidade, uf, sem_telefone, sem_whatsapp')
      .eq('company_id', company.id).order('created_at', { ascending: false }).limit(200);
    const list = (data ?? []) as Session[];
    setSessions(list);
    return list;
  }, [company?.id]);

  const loadLeadStats = useCallback(async () => {
    if (!company?.id) return;
    const { data } = await createClient().from('leads').select('status, nivel_interesse').eq('company_id', company.id).eq('import_source', 'PEG').limit(5000);
    const rows = (data ?? []) as { status: string | null; nivel_interesse: string | null }[];
    const count = (v: string) => rows.filter((r) => (r.nivel_interesse ?? '').toLowerCase().startsWith(v)).length;
    const byStage = new Map<string, number>();
    rows.forEach((r) => byStage.set(r.status || 'Sem etapa', (byStage.get(r.status || 'Sem etapa') ?? 0) + 1));
    setLeadStats({ total: rows.length, quente: count('quente'), morno: count('morno'), frio: count('frio'), stages: Array.from(byStage, ([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n) });
  }, [company?.id]);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => stopPolling, []);

  const watch = useCallback((s: Session) => {
    stopPolling();
    setRunning(s);
    const sb = createClient();
    pollRef.current = setInterval(async () => {
      const { data } = await sb.from('extraction_sessions')
        .select('id, requested, inserted, found, processed, status, created_at, segmento, cidade, uf, sem_telefone, sem_whatsapp').eq('id', s.id).single();
      if (!data) return;
      const cur = data as Session;
      setRunning(cur);
      const tooLong = Date.now() - +new Date(cur.created_at) > RUNNING_MAX_MS;
      if (cur.status === 'complete') {
        stopPolling();
        toast({ variant: 'success', title: 'Busca concluída', description: `${cur.inserted} de ${cur.requested} empresas tinham WhatsApp e entraram na Triagem.` });
      } else if (cur.status === 'error' || tooLong) {
        stopPolling();
        toast({ variant: 'destructive', title: cur.status === 'error' ? 'A busca não terminou' : 'A busca está demorando mais que o normal', description: 'O que já entrou na Triagem ficou salvo. Tente de novo em alguns minutos.' });
      } else return;
      setRunning(null);
      void loadSessions();
      void loadLeadStats();
    }, 3000);
  }, [loadSessions, loadLeadStats]);

  useEffect(() => {
    if (!enabled) return;
    void loadLeadStats();
    void loadSessions().then((list) => {
      // Se a página foi recarregada no meio de uma busca, volta a acompanhar
      const active = list.find((s) => s.status === 'running' && Date.now() - +new Date(s.created_at) < RUNNING_MAX_MS);
      if (active) watch(active);
    });
  }, [enabled, loadSessions, loadLeadStats, watch]);

  const stats = useMemo(() => {
    const done = sessions.filter((s) => s.status === 'complete');
    const requested = sessions.reduce((n, s) => n + s.requested, 0);
    const inserted = sessions.reduce((n, s) => n + s.inserted, 0);
    const doneRequested = done.reduce((n, s) => n + s.requested, 0);
    const doneInserted = done.reduce((n, s) => n + s.inserted, 0);
    return { count: sessions.length, requested, inserted, pct: requested ? Math.round((inserted / requested) * 100) : 0, per100: doneRequested >= 100 ? Math.round((doneInserted / doneRequested) * 100) : null, since: sessions.length ? sessions[sessions.length - 1].created_at : null };
  }, [sessions]);

  const nichoFinal = customOpen ? customNicho.trim() : nicho;

  async function start() {
    if (!company?.id) return;
    let url = '';
    if (mode === 'url') {
      if (!MAPS_URL.test(mapsUrl.trim())) { toast({ variant: 'destructive', title: 'Link inválido', description: 'Cole um link do Google Maps (google.com/maps ou google.com.br/maps).' }); return; }
      url = mapsUrl.trim();
    } else {
      if (!cidade.trim()) { toast({ variant: 'destructive', title: 'Informe a cidade' }); return; }
      if (!estado) { toast({ variant: 'destructive', title: 'Escolha o estado' }); return; }
      if (!nichoFinal) { toast({ variant: 'destructive', title: 'Escolha o segmento' }); return; }
      url = `https://www.google.com.br/maps/search/${encodeURIComponent(`${nichoFinal} em ${cidade}, ${estado}`)}`;
    }
    setStarting(true);
    try {
      const res = await fetch('/api/extraction/prospect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url, limit, companyId: company.id,
          cidade: mode === 'manual' ? cidade.trim() : undefined, estado: mode === 'manual' ? estado : undefined, nicho: mode === 'manual' ? nichoFinal : undefined,
          projectValue: projectValue ? parseFloat(projectValue.replace(',', '.')) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Não foi possível iniciar a busca');
      watch({
        id: data.sessionId, requested: data.requested, inserted: 0, found: 0, processed: 0, status: 'running', created_at: new Date().toISOString(),
        segmento: mode === 'manual' ? nichoFinal : null, cidade: mode === 'manual' ? cidade.trim() : null, uf: mode === 'manual' ? estado : null, sem_telefone: null, sem_whatsapp: null,
      });
      setCidade(''); setEstado(''); setNicho(''); setCustomNicho(''); setCustomOpen(false); setMapsUrl(''); setProjectValue('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível buscar', description: err?.message });
    } finally { setStarting(false); }
  }

  const header = (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Orbit</h1>
      <p className="text-[15px] text-muted-foreground">Encontra empresas no Google Maps que atendem no WhatsApp e leva para a Triagem do CRM, com nota e resumo.</p>
    </div>
  );

  if (userLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  // ── Não ativo ──
  if (!enabled) {
    return (
      <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-8 pb-14 pt-2">
        {header}
        <div className={cn(CARD, 'mx-auto flex w-full max-w-[700px] flex-col items-center gap-6 rounded-3xl px-10 py-11 text-center')}>
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted"><Lock className="h-7 w-7 text-muted-foreground" strokeWidth={1.8} /></span>
          <div className="flex flex-col gap-2">
            <h2 className="text-[28px] font-semibold leading-9 tracking-tight text-foreground">O Orbit ainda não está ativo na sua empresa</h2>
            <p className="text-base leading-normal text-muted-foreground">Fale com o time do Zaapply para ligar. Enquanto isso, o resto do sistema funciona normalmente.</p>
          </div>
          <ol className="flex w-full flex-col rounded-xl border border-border bg-muted text-left">
            {['Você escolhe a cidade e o segmento, por exemplo clínicas em Campinas.', 'O Orbit acha as empresas no Google Maps e confirma quais atendem no WhatsApp.', 'Elas chegam na Triagem do CRM com nota (quente, morna ou fria) e um resumo pronto.'].map((t, i) => (
              <li key={i} className={cn('flex items-center gap-4 px-5 py-4', i > 0 && 'border-t border-border')}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-[13px] font-semibold text-foreground">{i + 1}</span>
                <span className="text-[15px] leading-normal text-foreground">{t}</span>
              </li>
            ))}
          </ol>
          <Button className="h-[50px] px-8 text-base" asChild><Link href="/ajuda?tab=chamados">Falar com o time</Link></Button>
        </div>
      </div>
    );
  }

  // ── Buscando ──
  if (running) {
    const found = running.found;
    const phase = found === 0 ? 'collect' : running.processed < found ? 'check' : 'finish';
    const pct = found === 0 ? null : Math.min(100, Math.round((running.processed / found) * 100));
    const stageLabel = phase === 'collect' ? 'Buscando as empresas no Google Maps' : phase === 'check' ? 'Validando números de WhatsApp' : 'Finalizando';
    const steps = [
      { label: 'Conectou ao Google Maps', state: 'done' },
      { label: 'Coletou as empresas', state: found > 0 ? 'done' : 'active' },
      { label: 'Confere quais têm WhatsApp', state: found === 0 ? 'todo' : phase === 'check' ? 'active' : 'done' },
      { label: 'Dá a nota e escreve o resumo', state: running.inserted > 0 ? (phase === 'check' ? 'active' : 'done') : 'todo' },
      { label: 'Coloca na Triagem do CRM', state: running.inserted > 0 ? (phase === 'check' ? 'active' : 'done') : 'todo' },
    ] as const;
    return (
      <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-8 pb-14 pt-2">
        {header}
        <div className={cn(CARD, 'mx-auto flex w-full max-w-[760px] flex-col gap-6 rounded-3xl px-11 py-10')}>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[28px] font-semibold leading-9 tracking-tight text-foreground">Buscando {running.segmento ? running.segmento.toLowerCase() : 'empresas'}{running.cidade ? ` em ${running.cidade}` : ''}</h2>
            <p className="text-base text-muted-foreground">{running.requested} empresas pedidas. Acompanhe por aqui até terminar.</p>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[15px]"><span className="font-semibold text-foreground">{stageLabel}</span><span className="text-muted-foreground">{pct == null ? 'Iniciando' : `${pct}%`}</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full bg-[#01573C] transition-all duration-700 dark:bg-[#96F63C]', pct == null && 'animate-pulse')} style={{ width: `${pct == null ? 8 : Math.max(pct, 3)}%` }} /></div>
          </div>
          <div className="flex items-baseline gap-3.5 rounded-xl border border-border bg-muted px-6 py-5">
            <span className={cn('text-[40px] font-semibold leading-none tracking-tight', LIME)}>{running.inserted}</span>
            <span className="text-base text-foreground">empresas com WhatsApp já entraram na Triagem</span>
          </div>
          <ul className="flex flex-col rounded-xl border border-border bg-muted">
            {steps.map((s, i) => (
              <li key={s.label} className={cn('flex items-center gap-3.5 px-5 py-3.5 text-[15px]', i > 0 && 'border-t border-border', s.state === 'todo' ? 'text-muted-foreground' : 'text-foreground', s.state === 'active' && 'font-semibold')}>
                {s.state === 'done' ? <Check className={cn('h-4 w-4', LIME)} strokeWidth={2.6} /> : s.state === 'active' ? <Loader2 className={cn('h-4 w-4 animate-spin', LIME)} /> : <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />}
                {s.label}
              </li>
            ))}
          </ul>
          <p className="text-sm leading-normal text-muted-foreground">Empresas sem telefone no Maps ou com telefone sem WhatsApp ficam de fora. No fim, mostramos quantas foram cada uma.</p>
        </div>
      </div>
    );
  }

  // ── Principal ──
  const visible = showAll ? sessions : sessions.slice(0, 8);
  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      {header}
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <form onSubmit={(e) => { e.preventDefault(); void start(); }} className={cn(CARD, 'flex w-full shrink-0 flex-col gap-5 px-8 py-8 xl:w-[600px]')}>
          <CardTitle title="Nova busca" />
          <div role="tablist" aria-label="Como buscar" className="flex w-fit items-center rounded-full bg-muted p-1">
            {([['manual', 'Cidade e segmento'], ['url', 'Link do Google Maps']] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn('rounded-full px-5 py-2 text-sm transition-colors', mode === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}>{label}</button>
            ))}
          </div>

          {mode === 'manual' ? (
            <>
              <div className="grid grid-cols-[1fr_120px] gap-4">
                <div className="flex flex-col gap-2"><FieldLabel htmlFor="ob-city">Cidade</FieldLabel><input id="ob-city" className={FIELD} placeholder="São Paulo" value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
                <div className="flex flex-col gap-2">
                  <FieldLabel>Estado</FieldLabel>
                  <Select value={estado} onValueChange={setEstado}><SelectTrigger className="h-[50px] rounded-xl border-border bg-muted px-4 text-[15px]"><SelectValue placeholder="UF" /></SelectTrigger><SelectContent>{ESTADOS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold text-foreground">Segmento</p>
                <div className="flex flex-wrap gap-2">
                  {NICHOS.map((n) => <button key={n} type="button" aria-pressed={!customOpen && nicho === n} onClick={() => { setNicho(n); setCustomOpen(false); }} className={chip(!customOpen && nicho === n)}>{n}</button>)}
                  <button type="button" aria-pressed={customOpen} onClick={() => { setCustomOpen(true); setNicho(''); }} className={cn(chip(customOpen), !customOpen && 'border-dashed text-muted-foreground')}>Outro segmento…</button>
                </div>
                {customOpen && <input aria-label="Outro segmento" autoFocus className={FIELD} placeholder="Ex.: Clínicas veterinárias" value={customNicho} onChange={(e) => setCustomNicho(e.target.value)} />}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="ob-url">Link da busca no Google Maps</FieldLabel>
              <input id="ob-url" className={cn(FIELD, 'font-mono text-[13px]')} placeholder="https://www.google.com/maps/search/…" value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} />
              <p className="text-[13px] text-muted-foreground">Faça a busca no Google Maps, copie o endereço da página e cole aqui.</p>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-semibold text-foreground">Quantas empresas pedir</p>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6" role="radiogroup" aria-label="Quantas empresas pedir">
              {LEAD_LIMITS.map((n) => <button key={n} type="button" role="radio" aria-checked={limit === n} onClick={() => setLimit(n)} className={cn('h-12 rounded-xl border text-[15px] transition-colors', limit === n ? 'border-[#1E6B47] bg-accent font-semibold text-foreground' : 'border-border bg-muted text-foreground hover:border-foreground/30')}>{n}</button>)}
            </div>
            <p className="flex items-start gap-3 rounded-xl border border-border bg-muted px-4 py-3.5 text-sm leading-normal text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              Só entram empresas com telefone que tem WhatsApp. {stats.per100 != null ? `No seu histórico, entram cerca de ${stats.per100} a cada 100 pedidos, então peça mais do que precisa.` : 'Costuma entrar só uma parte do que você pede, então peça mais do que precisa.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="ob-value" optional>Valor do projeto</FieldLabel>
            <input id="ob-value" inputMode="decimal" className={FIELD} placeholder="R$ 0,00" value={projectValue} onChange={(e) => setProjectValue(e.target.value.replace(/[^\d.,]/g, ''))} />
            <p className="text-[13px] text-muted-foreground">Se preencher, esse valor vale para todos os leads desta busca.</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button type="submit" className="h-[50px] px-8 text-base" disabled={starting}>{starting && <Loader2 className="h-4 w-4 animate-spin" />} Buscar leads</Button>
            <span className="text-sm text-muted-foreground">Leva de 1 a 3 minutos.</span>
          </div>
        </form>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="grid gap-5 md:grid-cols-3">
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}><p className="text-[15px] text-foreground/85">Buscas feitas</p><p className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{stats.count}</p><p className="text-sm text-muted-foreground">{stats.since ? `desde ${new Date(stats.since).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : 'nenhuma ainda'}</p></div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}><p className="text-[15px] text-foreground/85">Empresas pedidas</p><p className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{stats.requested.toLocaleString('pt-BR')}</p><p className="text-sm text-muted-foreground">somando todas as buscas</p></div>
            <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}><p className="text-[15px] text-foreground/85">Entraram no CRM</p><p className="flex items-baseline gap-2"><span className={cn('text-[34px] font-semibold leading-[42px] tracking-tight', LIME)}>{stats.inserted.toLocaleString('pt-BR')}</span>{stats.requested > 0 && <span className={cn('text-base font-semibold', LIME)}>{stats.pct}%</span>}</p><p className="text-sm text-muted-foreground">com WhatsApp confirmado</p></div>
          </div>

          <section className={cn(CARD, 'flex flex-col gap-3 px-7 py-7')}>
            <div className="flex items-baseline justify-between"><h2 className="text-xl font-semibold text-foreground">Suas buscas</h2><span className="text-sm text-muted-foreground">Mais recentes primeiro</span></div>
            {sessions.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-muted-foreground">Sua primeira busca aparece aqui.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead><tr className="text-left text-[13px] tracking-[0.06em] text-muted-foreground"><th className="py-3 font-medium">QUANDO</th><th className="py-3 font-medium">SEGMENTO E CIDADE</th><th className="py-3 text-right font-medium">PEDIDAS</th><th className="py-3 pl-6 text-right font-medium">ENTRARAM</th></tr></thead>
                    <tbody>
                      {visible.map((s) => (
                        <tr key={s.id} className="border-t border-border text-[15px]">
                          <td className="py-3.5 pr-4 text-muted-foreground">{fmtWhen(s.created_at)}</td>
                          <td className="py-3.5 pr-4 text-foreground">{title(s)}{s.status === 'running' && <span className="ml-2 text-xs text-muted-foreground">em andamento</span>}{s.status === 'error' && <span className="ml-2 text-xs text-red-600 dark:text-red-400">não terminou</span>}</td>
                          <td className="py-3.5 text-right tabular-nums text-foreground">{s.requested}</td>
                          <td className={cn('py-3.5 pl-6 text-right font-semibold tabular-nums', s.inserted > 0 ? LIME : 'font-normal text-muted-foreground')}>{s.inserted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between pt-1"><span className="text-sm text-muted-foreground">{visible.length} de {sessions.length} {sessions.length === 1 ? 'busca' : 'buscas'}</span>{sessions.length > 8 && <Button variant="secondary" className="h-9 px-4 text-sm" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Ver menos' : 'Ver todas'}</Button>}</div>
              </>
            )}
          </section>

          <section className={cn(CARD, 'flex flex-col gap-4 px-7 py-7')}>
            <CardTitle title="O que aconteceu com esses leads" hint={leadStats ? `${leadStats.total} ${leadStats.total === 1 ? 'lead do Orbit está' : 'leads do Orbit estão'} no CRM com nota e resumo.` : undefined} />
            {!leadStats ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : leadStats.total === 0 ? <p className="text-[15px] text-muted-foreground">Quando a primeira busca terminar, você acompanha aqui o que aconteceu com os leads.</p> : (
              <>
                <div className="grid gap-3.5 sm:grid-cols-3">
                  {[['Quentes', leadStats.quente], ['Mornos', leadStats.morno], ['Frios', leadStats.frio]].map(([label, n]) => (
                    <div key={label as string} className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted px-[18px] py-4"><span className="text-[15px] text-foreground/85">{label}</span><span className="text-[28px] font-semibold leading-8 tracking-tight text-foreground">{n}</span></div>
                  ))}
                </div>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribuição dos leads por etapa do CRM">
                  {leadStats.stages.map((s, i) => <div key={s.name} style={{ width: `${(s.n / leadStats.total) * 100}%`, backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} title={`${s.name}: ${s.n}`} />)}
                </div>
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/85">
                  {leadStats.stages.map((s, i) => <li key={s.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] }} />{s.name} {s.n}</li>)}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
