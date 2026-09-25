'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Info, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MetaWhatsAppConnect } from './MetaWhatsAppConnect';
import { MetaAdsConnect } from './MetaAdsConnect';
import { CARD, INPUT, LIME, PILL3D, PILL_GREEN, Toggle } from './ui';
import type { SdrCfg } from './useSdrConfig';

export type ConSub = 'whatsapp' | 'metaapi' | 'calendar' | 'horario' | 'metaads' | 'pixel' | 'googleads' | 'links' | 'asaas';
const ALIAS: Record<string, ConSub> = { meta: 'metaads' };
export const normalizeSub = (s: string | null): ConSub => (s && (ALIAS[s] ?? (s as ConSub))) || 'whatsapp';

interface Resumo { lastMessageAt: string | null; conversationsAll: number; conversationsCtwa: number; conversationsGclid: number }
interface Link { id: number; slug: string; phone: string; mensagem: string | null; utm_campaign: string | null; utm_source: string | null; gclid_capture: boolean; cliques: number }
interface DayConfig { day_of_week: number; open_time: string; close_time: string; closed: boolean }

const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const DEFAULT_HOURS: DayConfig[] = DAYS.map((_, i) => ({ day_of_week: i, open_time: '08:00', close_time: '18:00', closed: i === 0 || i === 6 }));
const DEFAULT_ABSENCE = 'No momento estamos fora do horário de atendimento. Assim que reabrirmos, um de nossos atendentes ou nosso assistente virtual dará continuidade à conversa.';
const DURATIONS = [15, 30, 45, 60, 90, 120];

const dm = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const hm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const fmtN = (n: number) => n.toLocaleString('pt-BR');
function fmtPhone(raw: string): string {
  const d = raw.replace(/D/g, '');
  const m = d.match(/^55(d{2})(d{4,5})(d{4})$/);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : `+${d}`;
}
const jget = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// ─── Peças ────────────────────────────────────────────────────────────────────

function Head({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[28px] font-semibold leading-8 tracking-tight text-foreground">{title}</h2>
      <p className="text-[15px] text-muted-foreground">{desc}</p>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1"><h3 className="text-xl font-semibold text-foreground">{title}</h3>{sub && <p className="text-[15px] text-muted-foreground">{sub}</p>}</div>
      {children}
    </section>
  );
}

function StatusCard({ tone, title, sub, actions, rows, children }: { tone: 'ok' | 'off' | 'warn'; title: string; sub?: string; actions?: React.ReactNode; rows?: { k: string; v: React.ReactNode; warn?: boolean }[]; children?: React.ReactNode }) {
  return (
    <div className={cn(CARD, 'flex flex-col')}>
      <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-6">
        <div className="flex items-start gap-4">
          <span className={cn('mt-2.5 h-3 w-3 shrink-0 rounded-full', tone === 'ok' ? 'bg-[#01573C] dark:bg-[#96F63C]' : tone === 'warn' ? 'bg-amber-500' : 'bg-muted-foreground/50')} />
          <div className="flex flex-col gap-1"><p className="text-2xl font-semibold leading-8 tracking-tight text-foreground">{title}</p>{sub && <p className="text-[15px] text-muted-foreground">{sub}</p>}</div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {rows && rows.length > 0 && (
        <dl className="mx-7 mb-6 flex flex-col border-t border-border">
          {rows.map((r, i) => (
            <div key={r.k} className={cn('flex items-center justify-between gap-4 py-4 text-[15px]', i > 0 && 'border-t border-border')}>
              <dt className="text-muted-foreground">{r.k}</dt>
              <dd className={cn('text-right font-semibold', r.warn ? 'text-amber-600 dark:text-[#F5B544]' : 'text-foreground')}>{r.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  );
}

const DangerLink = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className="text-[15px] font-semibold text-red-600 hover:underline dark:text-[#F0736D]">{children}</button>
);

function CheckList({ items, info }: { items: string[]; info?: number }) {
  return (
    <div className={cn(CARD, 'flex flex-col')}>
      {items.map((t, i) => (
        <div key={t} className={cn('flex items-center gap-4 px-6 py-4 text-[15px] text-foreground', i > 0 && 'border-t border-border')}>
          {info === i
            ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">!</span>
            : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E4F1E9] dark:bg-[#12301F]"><Check className={cn('h-3.5 w-3.5', LIME)} strokeWidth={2.6} /></span>}
          {t}
        </div>
      ))}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <div className={cn(CARD, 'flex flex-col')}>
      {items.map((t, i) => (
        <div key={t} className={cn('flex items-center gap-4 px-6 py-4 text-[15px] text-foreground', i > 0 && 'border-t border-border')}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-foreground">{i + 1}</span>{t}
        </div>
      ))}
    </div>
  );
}

function InfoCards({ items, cols = 3 }: { items: [string, string][]; cols?: 2 | 3 }) {
  return (
    <div className={cn('grid gap-4', cols === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
      {items.map(([t, d]) => (
        <div key={t} className={cn(CARD, 'flex flex-col gap-1.5 px-6 py-5')}><p className="text-base font-semibold text-foreground">{t}</p><p className="text-[15px] leading-[150%] text-muted-foreground">{d}</p></div>
      ))}
    </div>
  );
}

// ─── Painéis ──────────────────────────────────────────────────────────────────

function QrDialog({ open, onClose, onConnected }: { open: boolean; onClose: () => void; onConnected: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState('connecting');

  const start = useCallback(async () => {
    setStarting(true);
    setQr(null); setPairing(null);
    try {
      const res = await fetch('/api/sdr/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Não foi possível gerar o código');
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Não foi possível gerar o código', variant: 'destructive' });
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => { if (open) void start(); }, [open, start]);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(async () => {
      const d = await jget('/api/sdr/status');
      if (!d) return;
      setStatus(d.status ?? 'connecting');
      setQr(d.qrcode ?? null);
      setPairing(d.pairingCode ?? null);
      if (d.status === 'connected') { toast({ title: 'WhatsApp conectado', variant: 'success' }); onConnected(); onClose(); }
    }, 3000);
    return () => clearInterval(t);
  }, [open, onConnected, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Conectar o WhatsApp</DialogTitle><DialogDescription>Abra o WhatsApp no celular, toque em Aparelhos conectados e depois em Conectar um aparelho. Aponte a câmera para o código.</DialogDescription></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {pairing && !qr ? (
            <div className="rounded-2xl bg-white px-7 py-5"><span className="font-mono text-3xl font-bold tracking-[0.3em] text-[#111]">{pairing}</span></div>
          ) : (
            <div className="rounded-2xl bg-white p-4">{qr ? <img src={`data:image/png;base64,${qr}`} alt="QR code para conectar o WhatsApp" width={220} height={220} className="block h-[220px] w-[220px]" /> : <div className="flex h-[220px] w-[220px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-neutral-500" /></div>}</div>
          )}
          <p className="text-sm text-muted-foreground">{qr || pairing ? 'Aguardando a leitura do código…' : status === 'connecting' && !starting ? 'Conectando ao WhatsApp…' : 'Gerando o código…'}</p>
          <button type="button" onClick={() => void start()} disabled={starting} className={cn(PILL3D, 'h-10 text-sm')}>{starting ? 'Gerando…' : 'Gerar novo código'}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WhatsAppPanel({ cfg, agent, resumo, reload, go }: { cfg: SdrCfg; agent: string; resumo: Resumo | null; reload: () => Promise<void>; go: (s: ConSub) => void }) {
  const [qrOpen, setQrOpen] = useState(false);
  const connected = cfg.instance_status === 'connected';
  const meta = cfg.whatsapp_provider === 'meta';
  const stale = !!resumo?.lastMessageAt && daysAgo(resumo.lastMessageAt) >= 2;

  async function disconnect() {
    if (!window.confirm(`Desconectar o WhatsApp? A ${agent} para de responder até você conectar de novo.`)) return;
    const res = await fetch(meta ? '/api/meta/whatsapp/connect' : '/api/sdr/connect', { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast({ title: j?.error ?? 'Não foi possível desconectar', variant: 'destructive' }); return; }
    toast({ title: 'WhatsApp desconectado', variant: 'success' });
    await reload();
  }

  return (
    <div className="flex flex-col gap-8">
      <Head title="WhatsApp" desc={`É o número por onde a ${agent} conversa com os leads.`} />
      <StatusCard
        tone={connected ? (stale ? 'warn' : 'ok') : 'off'}
        title={connected ? 'Conectado' : cfg.instance_status === 'connecting' ? 'Conectando' : 'Desconectado'}
        sub={connected ? undefined : 'Conecte um número para o agente conversar com os leads.'}
        actions={connected ? (<><button type="button" onClick={() => (meta ? go('metaapi') : setQrOpen(true))} className={PILL3D}>Reconectar</button><DangerLink onClick={disconnect}>Desconectar</DangerLink></>) : <button type="button" onClick={() => setQrOpen(true)} className={PILL_GREEN}>Conectar por QR code</button>}
        rows={connected ? [
          { k: 'Número', v: cfg.instance_phone ? fmtPhone(cfg.instance_phone) : 'Não informado' },
          { k: 'Forma de conexão', v: meta ? 'API oficial da Meta' : 'QR code (WhatsApp Web)' },
          { k: 'Nome da conexão', v: cfg.persona.empresa || 'Sem nome' },
          { k: 'Última mensagem', v: resumo?.lastMessageAt ? `${dm(resumo.lastMessageAt)} às ${hm(resumo.lastMessageAt)}${daysAgo(resumo.lastMessageAt) > 0 ? `, há ${daysAgo(resumo.lastMessageAt)} ${daysAgo(resumo.lastMessageAt) === 1 ? 'dia' : 'dias'}` : ''}` : 'Nenhuma ainda', warn: stale },
        ] : undefined}
      >
        {connected && stale && (
          <div className="mx-7 mb-4 flex flex-col gap-1.5 rounded-xl border border-[#F5B544]/35 bg-[#F5B544]/[0.08] px-5 py-4">
            <p className="text-[15px] font-semibold text-foreground">Nada chegou nem saiu desde então</p>
            <p className="text-sm text-[#8A6A1F] dark:text-[#C9B27A]">O status diz conectado, mas o número está em silêncio. A {agent} só responde quando chega mensagem.</p>
          </div>
        )}
        {connected && <p className="mx-7 mb-6 text-[13px] text-muted-foreground">Ao desconectar, a {agent} para de responder até você conectar de novo.</p>}
      </StatusCard>

      <Section title="Forma de conexão" sub={`Você pode usar uma de duas. Hoje está ${meta ? 'na API oficial' : 'no QR code'}.`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn(CARD, 'flex flex-col gap-3 px-6 py-5', !meta && 'border-[#01573C]/40 bg-[#E4F1E9] dark:border-[#96F63C]/25 dark:bg-[#12301F]')}>
            <div className="flex items-center justify-between"><p className="text-lg font-semibold text-foreground">QR code</p><span className={cn('rounded-full px-3 py-1 text-xs font-semibold', !meta ? 'bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]' : 'bg-muted text-muted-foreground')}>{!meta ? 'Em uso' : 'Alternativa'}</span></div>
            <p className="text-[15px] leading-[160%] text-foreground/85">Você escaneia o QR code, como no WhatsApp Web. É o jeito mais simples de começar.</p>
          </div>
          <div className={cn(CARD, 'flex flex-col gap-3 px-6 py-5', meta && 'border-[#01573C]/40 bg-[#E4F1E9] dark:border-[#96F63C]/25 dark:bg-[#12301F]')}>
            <div className="flex items-center justify-between"><p className="text-lg font-semibold text-foreground">API oficial da Meta</p><span className={cn('rounded-full px-3 py-1 text-xs font-semibold', meta ? 'bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]' : 'bg-muted text-muted-foreground')}>{meta ? 'Em uso' : 'Opcional'}</span></div>
            <p className="text-[15px] leading-[160%] text-foreground/85">É a conexão oficial do WhatsApp, sem risco de bloqueio do número. O número continua no app do WhatsApp Business.</p>
            {!meta && <button type="button" onClick={() => go('metaapi')} className={cn(PILL_GREEN, 'h-[46px] w-fit')}>Conectar a API oficial</button>}
          </div>
        </div>
      </Section>
      <QrDialog open={qrOpen} onClose={() => setQrOpen(false)} onConnected={() => void reload()} />
    </div>
  );
}

function MetaApiPanel({ cfg, agent, reload }: { cfg: SdrCfg; agent: string; reload: () => Promise<void> }) {
  const on = cfg.whatsapp_provider === 'meta' && !!cfg.meta_wa_phone_number_id;
  async function disconnect() {
    if (!window.confirm('Desconectar a API oficial? O WhatsApp volta a usar o QR code, se estiver conectado.')) return;
    const res = await fetch('/api/meta/whatsapp/connect', { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast({ title: j?.error ?? 'Não foi possível desconectar', variant: 'destructive' }); return; }
    toast({ title: 'API oficial desconectada', variant: 'success' });
    await reload();
  }
  return (
    <div className="flex flex-col gap-8">
      <Head title="API oficial da Meta" desc="É a conexão oficial do WhatsApp com a Meta, uma alternativa ao QR code." />
      <StatusCard
        tone={on ? 'ok' : 'off'}
        title={on ? 'Conectada' : 'Não conectada'}
        sub={on ? undefined : 'O WhatsApp está usando o QR code.'}
        actions={<><MetaWhatsAppConnect appearance="paper" connected={on} phoneNumber={cfg.meta_wa_phone_number_id} onConnected={() => void reload()} onDisconnect={() => undefined} />{on && <DangerLink onClick={disconnect}>Desconectar</DangerLink>}</>}
        rows={on ? [{ k: 'Número (identificador na Meta)', v: cfg.meta_wa_phone_number_id ?? '' }, { k: 'Conta do WhatsApp Business', v: cfg.meta_wa_waba_id ?? 'Não informada' }] : undefined}
      />
      <Section title="Por que usar"><CheckList items={['Conexão oficial, sem risco de bloqueio do número', 'O número continua funcionando no app do WhatsApp Business', 'A Meta cobra as mensagens diretamente de você, pela tabela dela']} info={2} /></Section>
      <Section title="O que você precisa">
        <InfoCards cols={2} items={[['Uma conta da Meta', 'A mesma que você usa no Facebook e no Gerenciador de Anúncios.'], ['Um número no WhatsApp Business', `Pode ser o mesmo número que a ${agent} usa hoje.`]]} />
        <p className="text-sm text-muted-foreground">Enquanto você não concluir, a {agent} continua no QR code.</p>
      </Section>
    </div>
  );
}

function CalendarPanel({ cfg, agent, save }: { cfg: SdrCfg; agent: string; save: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [g, setG] = useState<{ connected: boolean; email: string | null; connected_at?: string | null } | null>(null);
  const [cals, setCals] = useState<{ id: string; summary: string; primary: boolean }[]>([]);
  const [title, setTitle] = useState(cfg.event_title_template);
  const load = useCallback(() => { void jget('/api/google/status').then((d) => setG(d ?? { connected: false, email: null })); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (g?.connected) void jget('/api/google/calendars').then((d) => setCals(d?.calendars ?? [])); }, [g?.connected]);
  useEffect(() => { setTitle(cfg.event_title_template); }, [cfg.event_title_template]);

  async function disconnect() {
    if (!window.confirm('Desconectar o Google Calendar? A agenda deixa de ser usada para marcar reuniões.')) return;
    await fetch('/api/google/status', { method: 'DELETE' });
    await save({ google_calendar_id: '' });
    toast({ title: 'Google Calendar desconectado', variant: 'success' });
    load();
  }
  const go = () => { window.location.href = '/api/google/auth'; };
  const current = cals.find((c) => c.id === cfg.google_calendar_id) ?? cals.find((c) => c.primary);
  if (!g) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex flex-col gap-8">
      <Head title="Google Calendar" desc={`É a agenda onde a ${agent} marca as reuniões.`} />
      <StatusCard
        tone={g.connected ? 'ok' : 'off'}
        title={g.connected ? 'Conectado' : 'Não conectado'}
        sub={g.connected ? undefined : `Conecte uma conta Google para a ${agent} marcar reuniões sozinha.`}
        actions={g.connected ? (<><button type="button" onClick={go} className={PILL3D}>Reconectar</button><DangerLink onClick={disconnect}>Desconectar</DangerLink></>) : <button type="button" onClick={go} className={PILL_GREEN}>Conectar o Google Calendar</button>}
        rows={g.connected ? [
          { k: 'Conta do Google', v: g.email ?? '' },
          { k: 'Agenda usada', v: cals.length > 1 ? (
            <select aria-label="Agenda usada" value={current?.id ?? ''} onChange={(e) => void save({ google_calendar_id: e.target.value })} className="max-w-[360px] rounded-lg border border-border bg-muted px-3 py-1.5 text-[15px] font-semibold text-foreground outline-none dark:border-[#2A2A2A] dark:bg-[#181818]">{cals.map((c) => <option key={c.id} value={c.id}>{c.summary}</option>)}</select>
          ) : (current?.summary ?? g.email ?? '') },
          ...(g.connected_at ? [{ k: 'Conectado em', v: dm(g.connected_at) }] : []),
        ] : undefined}
      />
      <Section title="Como as reuniões são marcadas" sub={`A ${agent} oferece só os horários livres desta agenda.`}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-2.5"><label htmlFor="cal-dur" className="text-[15px] font-semibold text-foreground">Duração de cada reunião</label>
            <select id="cal-dur" value={cfg.meeting_duration_min ?? 60} onChange={(e) => void save({ meeting_duration_min: Number(e.target.value) })} className={cn(INPUT, 'h-[52px] py-0')}>{DURATIONS.map((d) => <option key={d} value={d}>{d} minutos</option>)}</select></div>
          <div className="flex flex-col gap-2.5"><label htmlFor="cal-title" className="text-[15px] font-semibold text-foreground">Título do evento na agenda</label>
            <input id="cal-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title !== cfg.event_title_template) void save({ event_title_template: title }); }} placeholder="Ex: Call de vendas - {nome}" className={cn(INPUT, 'h-[52px] py-0')} />
            <p className="text-[13px] text-muted-foreground">Use {'{nome}'} para colocar o nome do lead.</p></div>
        </div>
      </Section>
    </div>
  );
}

function HorarioPanel({ agent }: { agent: string }) {
  const [hours, setHours] = useState<DayConfig[]>(DEFAULT_HOURS);
  const [message, setMessage] = useState('');
  const [always, setAlways] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void jget('/api/business-hours').then((d) => {
      if (d?.data?.length) setHours(DEFAULT_HOURS.map((def) => (d.data as DayConfig[]).find((r) => r.day_of_week === def.day_of_week) ?? def));
      setMessage(d?.message ?? '');
      setAlways(!!d?.ativo24h);
      setLoading(false);
    });
  }, []);

  async function put(next: { ativo24h: boolean }, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/business-hours', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hours, message, ativo24h: next.ativo24h }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Não foi possível salvar');
      toast({ title: okMsg, variant: 'success' });
      return true;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Não foi possível salvar', variant: 'destructive' });
      return false;
    } finally { setBusy(false); }
  }
  const upd = (d: number, p: Partial<DayConfig>) => setHours((h) => h.map((x) => (x.day_of_week === d ? { ...x, ...p } : x)));
  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex flex-col gap-8">
      <Head title="Horário de atendimento" desc={`Define quando a ${agent} responde os leads.`} />
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[14px] border border-[#01573C]/30 bg-[#E4F1E9] px-8 py-7 dark:border-[#96F63C]/20 dark:bg-[#12301F]">
        <div className="flex flex-col gap-1.5"><p className="text-2xl font-semibold tracking-tight text-foreground">Atender 24 horas por dia</p>
          <p className="text-[15px] text-foreground/85">{always ? `Hoje a ${agent} responde a qualquer hora, inclusive de madrugada e no fim de semana.` : 'Desligado: a resposta segue os dias e horários abaixo.'}</p></div>
        <Toggle on={always} disabled={busy} label="Atender 24 horas por dia" onChange={async (v) => { setAlways(v); const ok = await put({ ativo24h: v }, v ? 'Atendimento 24 horas ligado' : 'Atendimento 24 horas desligado'); if (!ok) setAlways(!v); }} />
      </div>

      <Section title="Se você desligar" sub={`Você escolhe em quais dias e horários a ${agent} atende. Fora deles, ela envia uma mensagem de aviso.`}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className={cn(CARD, 'flex flex-col gap-3 px-6 py-5')}>
            <p className="text-base font-semibold text-foreground">Dias e horários</p>
            {always ? <p className="text-[15px] leading-[160%] text-muted-foreground">Um horário de abertura e de fechamento para cada dia da semana. Dias sem atendimento ficam fechados.</p> : (
              <div className="flex flex-col">{hours.map((h) => (
                <div key={h.day_of_week} className="flex flex-wrap items-center gap-3 border-t border-border py-2.5 first:border-t-0">
                  <span className="w-[120px] text-[15px] text-foreground">{DAYS[h.day_of_week]}</span>
                  <Toggle on={!h.closed} onChange={(v) => upd(h.day_of_week, { closed: !v })} label={`Atender ${DAYS[h.day_of_week]}`} />
                  {h.closed ? <span className="text-sm text-muted-foreground">Fechado</span> : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="time" aria-label="Abre às" value={h.open_time} onChange={(e) => upd(h.day_of_week, { open_time: e.target.value })} className="rounded-lg border border-border bg-muted px-2 py-1 text-foreground outline-none dark:border-[#2A2A2A] dark:bg-[#181818]" />até
                      <input type="time" aria-label="Fecha às" value={h.close_time} onChange={(e) => upd(h.day_of_week, { close_time: e.target.value })} className="rounded-lg border border-border bg-muted px-2 py-1 text-foreground outline-none dark:border-[#2A2A2A] dark:bg-[#181818]" />
                    </span>)}
                </div>))}</div>)}
          </div>
          <div className={cn(CARD, 'flex flex-col gap-3 px-6 py-5')}>
            <p className="text-base font-semibold text-foreground">Mensagem fora do horário</p>
            {always ? (
              <><p className="rounded-xl bg-[#E4F1E9] px-4 py-3 text-[15px] leading-[150%] text-foreground dark:bg-[#12301F]">{message || 'No momento estamos fora do horário de atendimento. Assim que retomarmos, responderemos sua mensagem.'}</p><p className="text-[13px] text-muted-foreground">Exemplo de mensagem padrão. Você pode trocar o texto.</p></>
            ) : (
              <textarea aria-label="Mensagem fora do horário" rows={5} value={message} placeholder={DEFAULT_ABSENCE} onChange={(e) => setMessage(e.target.value)} className={cn(INPUT, 'resize-none leading-[150%]')} />)}
          </div>
        </div>
        {!always && <button type="button" disabled={busy} onClick={() => void put({ ativo24h: false }, 'Horários salvos')} className={cn(PILL_GREEN, 'w-fit')}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar horários'}</button>}
      </Section>
    </div>
  );
}

function MetaAdsPanel({ cfg, reload }: { cfg: SdrCfg; reload: () => Promise<void> }) {
  const on = !!cfg.meta_ad_account_id;
  async function disconnect() {
    if (!window.confirm('Desconectar a conta de anúncios? O Dashboard deixa de mostrar custo por conversa.')) return;
    const res = await fetch('/api/meta/ads/connect', { method: 'DELETE' });
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast({ title: j?.error ?? 'Não foi possível desconectar', variant: 'destructive' }); return; }
    toast({ title: 'Conta de anúncios desconectada', variant: 'success' });
    await reload();
  }
  return (
    <div className="flex flex-col gap-8">
      <Head title="Meta Ads" desc="Traz do Meta o que você gasta e quantas conversas cada anúncio gera." />
      <StatusCard tone={on ? 'ok' : 'off'} title={on ? 'Conectado' : 'Não conectado'} sub={on ? undefined : 'Opcional. Serve para quem anuncia no Meta.'}
        actions={<><MetaAdsConnect appearance="paper" tone={on ? 'dark' : 'green'} connected={on} accountName={cfg.meta_ad_account_name} onConnected={() => void reload()} onDisconnect={() => undefined} />{on && <DangerLink onClick={disconnect}>Desconectar</DangerLink>}</>}
        rows={on ? [{ k: 'Conta de anúncios', v: cfg.meta_ad_account_name ?? cfg.meta_ad_account_id ?? '' }] : undefined} />
      <Section title="O que isso mostra no Dashboard"><InfoCards items={[['Quanto você gasta', 'O investimento em anúncios no período escolhido.'], ['Custo por conversa', 'Quanto cada conversa iniciada pelo anúncio custou.'], ['Ranking de anúncios', 'Quais anúncios trazem mais conversas.']]} /></Section>
    </div>
  );
}

function PixelPanel({ cfg, resumo, save }: { cfg: SdrCfg; resumo: Resumo | null; save: (p: Record<string, unknown>) => Promise<boolean> }) {
  const on = !!cfg.meta_pixel_id;
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ id: '', token: '' });
  const [saving, setSaving] = useState(false);
  const total = resumo?.conversationsAll ?? 0;
  const ctwa = resumo?.conversationsCtwa ?? 0;
  const pct = total > 0 ? Math.round((ctwa / total) * 100) : 0;

  async function submit() {
    setSaving(true);
    const ok = await save({ meta_pixel_id: draft.id.trim(), meta_pixel_token: draft.token.trim() });
    setSaving(false);
    if (ok) { setEdit(false); setDraft({ id: '', token: '' }); toast({ title: 'Pixel configurado', variant: 'success' }); }
  }
  async function remove() {
    if (!window.confirm('Remover o pixel? As vendas deixam de ser avisadas à Meta.')) return;
    if (await save({ meta_pixel_id: '' })) toast({ title: 'Pixel removido', variant: 'success' });
  }

  return (
    <div className="flex flex-col gap-8">
      <Head title="Pixel da Meta" desc="Avisa a Meta quando um lead vira cliente, para ela ligar a venda ao anúncio certo." />
      <StatusCard tone={on ? 'ok' : 'off'} title={on ? 'Configurado' : 'Não configurado'} sub={on ? undefined : 'Opcional. Serve para quem anuncia no Meta.'}
        actions={on ? (<><button type="button" onClick={() => { setDraft({ id: cfg.meta_pixel_id ?? '', token: '' }); setEdit(true); }} className={PILL3D}>Editar</button><DangerLink onClick={remove}>Remover</DangerLink></>) : <button type="button" onClick={() => setEdit(true)} className={PILL_GREEN}>Configurar o pixel</button>}
        rows={on ? [{ k: 'Pixel', v: 'ID salvo e token oculto' }] : undefined}>
        {edit && (
          <div className="mx-7 mb-6 flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-5 dark:bg-[#141414]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2"><label htmlFor="px-id" className="text-[15px] font-semibold text-foreground">ID do pixel</label><input id="px-id" className={INPUT} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} placeholder="1234567890123456" /></div>
              <div className="flex flex-col gap-2"><label htmlFor="px-tk" className="text-[15px] font-semibold text-foreground">Token de acesso</label><input id="px-tk" type="password" className={INPUT} value={draft.token} onChange={(e) => setDraft({ ...draft, token: e.target.value })} placeholder="EAAxxxxx..." /></div>
            </div>
            <div className="flex items-center gap-3"><button type="button" disabled={saving || !draft.id.trim() || !draft.token.trim()} onClick={submit} className={PILL_GREEN}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar pixel'}</button><button type="button" onClick={() => setEdit(false)} className={PILL3D}>Cancelar</button></div>
          </div>
        )}
      </StatusCard>
      <Section title="Quantas conversas vieram de anúncio" sub="O pixel só consegue ligar a venda ao anúncio quando o clique foi identificado.">
        <div className={cn(CARD, 'flex flex-col gap-4 px-7 py-6')}>
          <p className="flex flex-wrap items-baseline gap-3"><span className="text-[40px] font-semibold leading-[46px] tracking-tight text-foreground">{fmtN(ctwa)}</span><span className="text-lg text-foreground/85">de {fmtN(total)} conversas têm o clique do anúncio identificado</span></p>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#01573C] dark:bg-[#96F63C]" style={{ width: `${pct}%` }} /></div>
          <p className="text-sm text-muted-foreground">{total > 0 ? `Cerca de ${pct}%. As demais chegaram sem clique de anúncio identificado.` : 'Ainda não há conversas.'}</p>
        </div>
      </Section>
    </div>
  );
}

function GoogleAdsPanel({ resumo }: { resumo: Resumo | null }) {
  const [s, setS] = useState<{ connected: boolean; email: string | null; customer_id: string | null } | null>(null);
  useEffect(() => { void jget('/api/google-ads/status').then((d) => setS(d ?? { connected: false, email: null, customer_id: null })); }, []);
  async function disconnect() {
    if (!window.confirm('Desconectar o Google Ads?')) return;
    await fetch('/api/google-ads/status', { method: 'DELETE' });
    setS({ connected: false, email: null, customer_id: null });
    toast({ title: 'Google Ads desconectado', variant: 'success' });
  }
  if (!s) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const go = () => { window.location.href = '/api/google-ads/auth'; };
  return (
    <div className="flex flex-col gap-8">
      <Head title="Google Ads" desc="Devolve ao Google as vendas que vieram de anúncio, para ele aprender quem compra de verdade." />
      <StatusCard tone={s.connected ? 'ok' : 'off'} title={s.connected ? 'Conectado' : 'Não conectado'} sub={s.connected ? undefined : 'Opcional. Serve para quem anuncia no Google.'}
        actions={s.connected ? (<><button type="button" onClick={go} className={PILL3D}>Reconectar</button><DangerLink onClick={disconnect}>Desconectar</DangerLink></>) : <button type="button" onClick={go} className={PILL_GREEN}>Conectar o Google Ads</button>}
        rows={s.connected ? [{ k: 'Conta do Google', v: s.email ?? '' }, ...(s.customer_id ? [{ k: 'Conta de anúncios', v: s.customer_id }] : [])] : undefined} />
      <Section title="Como funciona"><Steps items={['O lead clica no seu anúncio do Google e chama no WhatsApp', 'Quando ele compra, o Zaapply avisa o Google Ads', 'O Google passa a mostrar seus anúncios para quem parece com quem compra']} /></Section>
      <div className={cn(CARD, 'flex items-center justify-between gap-4 px-6 py-5')}><span className="text-[15px] text-foreground/85">Conversas com clique do Google Ads identificado</span><span className="text-xl font-semibold tabular-nums text-foreground">{fmtN(resumo?.conversationsGclid ?? 0)} de {fmtN(resumo?.conversationsAll ?? 0)}</span></div>
    </div>
  );
}

function LinksPanel({ resumo }: { resumo: Resumo | null }) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ phone: '', mensagem: '', utm_campaign: '', utm_source: '', gclid_capture: true });
  const load = useCallback(() => { void jget('/api/sdr/tracking-links').then((d) => setLinks(d?.links ?? [])); }, []);
  useEffect(() => { load(); }, [load]);
  const url = (l: Link) => `${window.location.origin}${l.gclid_capture ? `/l/${l.slug}?gclid={gclid}` : `/api/track/${l.slug}`}`;

  async function create() {
    if (!form.phone || (!form.utm_campaign && !form.utm_source)) { toast({ title: 'Informe o telefone e a campanha ou a fonte', variant: 'warning' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/sdr/tracking-links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setForm({ phone: '', mensagem: '', utm_campaign: '', utm_source: '', gclid_capture: true });
      setAdding(false);
      toast({ title: 'Link criado', variant: 'success' });
      load();
    } catch (e) { toast({ title: e instanceof Error ? e.message : 'Não foi possível criar o link', variant: 'destructive' }); }
    finally { setSaving(false); }
  }
  async function remove(id: number) {
    if (!window.confirm('Apagar este link? Quem clicar nele depois não chega mais ao WhatsApp.')) return;
    setLinks((p) => (p ?? []).filter((l) => l.id !== id));
    await fetch(`/api/sdr/tracking-links?id=${id}`, { method: 'DELETE' }).catch(() => undefined);
  }
  if (!links) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const has = links.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <Head title="Links rastreados" desc="Cada link leva o lead para o WhatsApp e guarda de onde ele veio." />
      <StatusCard tone={has ? 'ok' : 'off'} title={has ? `${links.length} ${links.length === 1 ? 'link criado' : 'links criados'}` : 'Nenhum link criado'} sub={has ? undefined : 'Opcional. Serve para origens que não são anúncios do Meta.'}
        actions={<button type="button" onClick={() => setAdding(true)} className={PILL_GREEN}>{has ? 'Novo link' : 'Criar o primeiro link'}</button>}>
        {adding && (
          <div className="mx-7 mb-6 flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-5 dark:bg-[#141414]">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2"><label htmlFor="tl-ph" className="text-[15px] font-semibold text-foreground">WhatsApp de destino</label><input id="tl-ph" className={INPUT} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5514999999999" /></div>
              <div className="flex flex-col gap-2"><label htmlFor="tl-cp" className="text-[15px] font-semibold text-foreground">Campanha</label><input id="tl-cp" className={INPUT} value={form.utm_campaign} onChange={(e) => setForm({ ...form, utm_campaign: e.target.value })} placeholder="Ex: bio-instagram" /></div>
            </div>
            <div className="flex flex-col gap-2"><label htmlFor="tl-ms" className="flex items-baseline gap-2 text-[15px] font-semibold text-foreground">Mensagem pronta<span className="text-[13px] font-normal text-muted-foreground">opcional</span></label><input id="tl-ms" className={INPUT} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} placeholder="Oi, vim pelo Instagram" /></div>
            <label className="flex items-center gap-3 text-[15px] text-foreground"><Toggle on={form.gclid_capture} onChange={(v) => setForm({ ...form, gclid_capture: v })} label="Capturar telefone e clique do Google" />Capturar o clique do Google antes de abrir o WhatsApp (recomendado para Google Ads)</label>
            <div className="flex items-center gap-3"><button type="button" disabled={saving} onClick={create} className={PILL_GREEN}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar link'}</button><button type="button" onClick={() => setAdding(false)} className={PILL3D}>Cancelar</button></div>
          </div>
        )}
        {has && (
          <div className="mx-7 mb-6 flex flex-col border-t border-border">
            {links.map((l, i) => (
              <div key={l.id} className={cn('flex items-center gap-4 py-4', i > 0 && 'border-t border-border')}>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5"><p className="truncate text-[15px] font-semibold text-foreground">{l.utm_campaign || l.utm_source}</p><p className="truncate text-[13px] text-muted-foreground">{url(l)} · {l.cliques} {l.cliques === 1 ? 'clique' : 'cliques'}</p></div>
                <button type="button" aria-label="Copiar link" onClick={() => navigator.clipboard.writeText(url(l)).then(() => toast({ title: 'Link copiado', variant: 'success' }))} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="h-4 w-4" /></button>
                <button type="button" aria-label="Apagar link" onClick={() => void remove(l.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </StatusCard>
      <Section title="Quando usar"><InfoCards items={[['No seu site', 'Um botão de WhatsApp que marca que o lead veio do site.'], ['Na bio ou em posts', 'Um link para o Instagram, que mostra qual campanha trouxe o lead.'], ['Em e-mails e mensagens', 'Um link por disparo, para saber qual deu resultado.']]} /></Section>
      <div className={cn(CARD, 'flex flex-col gap-1.5 px-6 py-5')}><p className="text-base font-semibold text-foreground">Anúncios do Meta não precisam de link</p><p className="text-[15px] text-muted-foreground">O clique do anúncio já é identificado sozinho: {fmtN(resumo?.conversationsCtwa ?? 0)} de {fmtN(resumo?.conversationsAll ?? 0)} conversas têm essa origem.</p></div>
    </div>
  );
}

function AsaasPanel({ cfg, agent, companyId, save }: { cfg: SdrCfg; agent: string; companyId: number | null; save: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [hook, setHook] = useState<{ url: string; token: string } | null>(null);
  useEffect(() => { void jget('/api/payment-integrations').then((d) => setOn(((d?.integrations ?? []) as { platform: string; active: boolean }[]).some((i) => i.platform === 'asaas' && i.active))); }, []);

  async function connect() {
    setBusy(true);
    try {
      const webhook_token = crypto.randomUUID();
      const res = await fetch('/api/payment-integrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'asaas', config: { access_token: key.trim(), webhook_token } }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Não foi possível conectar');
      setOn(true); setKey('');
      setHook({ url: `${window.location.origin}/api/webhooks/payment/${companyId ?? ''}/asaas`, token: webhook_token });
      toast({ title: 'Asaas conectado', variant: 'success' });
    } catch (e) { toast({ title: e instanceof Error ? e.message : 'Não foi possível conectar', variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!window.confirm(`Desconectar o Asaas? A ${agent} deixa de gerar cobranças.`)) return;
    await fetch('/api/payment-integrations', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: 'asaas' }) });
    setOn(false); setHook(null);
    toast({ title: 'Asaas desconectado', variant: 'success' });
  }
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast({ title: 'Copiado', variant: 'success' }));
  if (on === null) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex flex-col gap-8">
      <Head title="Asaas" desc={`Deixa a ${agent} gerar a cobrança e mandar o link de pagamento na própria conversa.`} />
      <StatusCard tone={on ? 'ok' : 'off'} title={on ? 'Conectado' : 'Não conectado'} sub={on ? undefined : 'Opcional. Serve para quem vende e cobra pelo WhatsApp.'} actions={on ? <DangerLink onClick={disconnect}>Desconectar</DangerLink> : undefined}>
        {on && (
          <div className="mx-7 mb-6 flex items-center justify-between gap-6 rounded-xl border border-border bg-muted/40 px-5 py-4 dark:bg-[#141414]">
            <div className="flex flex-col gap-1"><p className="text-[15px] font-semibold text-foreground">Cobrança recorrente (assinatura)</p><p className="text-sm text-muted-foreground">{cfg.billing_recurring ? 'Assinatura mensal, cobrada no cartão. Só o cartão fica disponível para o lead.' : 'Cobrança avulsa, paga uma vez. PIX, boleto ou cartão à escolha do lead.'}</p></div>
            <Toggle on={cfg.billing_recurring} onChange={(v) => void save({ billing_recurring: v })} label="Cobrança recorrente" />
          </div>
        )}
      </StatusCard>
      {hook && (
        <div className={cn(CARD, 'flex flex-col gap-4 px-7 py-6')}>
          <div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-[#F5B544]" /><div className="flex flex-col gap-1"><p className="text-[15px] font-semibold text-foreground">Falta um passo no painel do Asaas</p><p className="text-sm text-muted-foreground">Em Integrações, Webhooks, cadastre o endereço e o token abaixo. É assim que o Zaapply fica sabendo quando o pagamento é confirmado. Guarde o token agora: ele não aparece de novo.</p></div></div>
          {([['Endereço do webhook', hook.url], ['Token do webhook', hook.token]] as const).map(([k, v]) => (
            <div key={k} className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="mb-1 text-[13px] text-muted-foreground">{k}</p><p className="truncate rounded-xl border border-border bg-muted px-4 py-2.5 font-mono text-sm text-foreground dark:border-[#2A2A2A] dark:bg-[#181818]">{v}</p></div><button type="button" aria-label={`Copiar ${k}`} onClick={() => void copy(v)} className="mt-5 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="h-4 w-4" /></button></div>
          ))}
        </div>
      )}
      <Section title={`O que a ${agent} passa a fazer`}><CheckList items={['Gera PIX, boleto ou link de pagamento quando o lead aceita', 'Envia o link na conversa, sem passar para uma pessoa', 'Avisa no CRM e no dashboard quando o pagamento é confirmado']} /></Section>
      {!on && (
        <Section title="Conectar">
          <div className={cn(CARD, 'flex flex-col gap-4 px-7 py-6')}>
            <div className="flex flex-col gap-2.5"><label htmlFor="as-key" className="text-[15px] font-semibold text-foreground">Chave de API do Asaas</label><input id="as-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole aqui a chave da sua conta" className={cn(INPUT, 'h-[52px] py-0')} /></div>
            <p className="text-[13px] text-muted-foreground">Você encontra a chave no painel do Asaas, em Integrações. Ela fica guardada em segurança.</p>
            <button type="button" disabled={busy || key.trim().length < 10} onClick={connect} className={cn(PILL_GREEN, 'w-fit')}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Conectar o Asaas'}</button>
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Tela ─────────────────────────────────────────────────────────────────────

interface Item { id: ConSub; label: string; status: string; tone: 'ok' | 'warn' | 'off' }

export function SdrConexoes({ cfg, sub, onSub, save, reload, companyId }: { cfg: SdrCfg; sub: ConSub; onSub: (s: ConSub) => void; save: (p: Record<string, unknown>) => Promise<boolean>; reload: () => Promise<void>; companyId: number | null }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [aux, setAux] = useState<{ google: boolean; ads: boolean; asaas: boolean; always: boolean | null; links: number }>({ google: false, ads: false, asaas: false, always: null, links: 0 });
  const agent = cfg.persona.nome_agente || 'agente';

  const refresh = useCallback(() => {
    void jget('/api/sdr/resumo').then(setResumo);
    void Promise.all([jget('/api/google/status'), jget('/api/google-ads/status'), jget('/api/payment-integrations'), jget('/api/business-hours'), jget('/api/sdr/tracking-links')]).then(([g, a, p, h, l]) => {
      setAux({ google: !!g?.connected, ads: !!a?.connected, asaas: ((p?.integrations ?? []) as { platform: string; active: boolean }[]).some((i) => i.platform === 'asaas' && i.active), always: h ? !!h.ativo24h : null, links: (l?.links ?? []).length });
    });
  }, []);
  useEffect(() => { refresh(); }, [refresh, sub]);

  const reloadAll = useCallback(async () => { await reload(); refresh(); }, [reload, refresh]);
  const connected = cfg.instance_status === 'connected';
  const meta = cfg.whatsapp_provider === 'meta' && !!cfg.meta_wa_phone_number_id;
  const stale = !!resumo?.lastMessageAt && daysAgo(resumo.lastMessageAt) >= 2;

  const groups: { title: string; items: Item[] }[] = useMemo(() => [
    { title: 'Conversar com os leads', items: [
      { id: 'whatsapp', label: 'WhatsApp', status: !connected ? 'Desconectado' : stale && resumo?.lastMessageAt ? `Sem mensagens há ${daysAgo(resumo.lastMessageAt)} dias` : 'Conectado', tone: !connected ? 'off' : stale ? 'warn' : 'ok' },
      { id: 'metaapi', label: 'API oficial da Meta', status: meta ? 'Conectada' : 'Opcional', tone: meta ? 'ok' : 'off' },
    ] },
    { title: 'Marcar reuniões', items: [
      { id: 'calendar', label: 'Google Calendar', status: aux.google ? 'Conectado' : 'Opcional', tone: aux.google ? 'ok' : 'off' },
      { id: 'horario', label: 'Horário de atendimento', status: aux.always ? '24 horas' : aux.always === false ? 'Horário definido' : '…', tone: 'ok' },
    ] },
    { title: 'Medir os anúncios', items: [
      { id: 'metaads', label: 'Meta Ads', status: cfg.meta_ad_account_id ? 'Conectado' : 'Opcional', tone: cfg.meta_ad_account_id ? 'ok' : 'off' },
      { id: 'pixel', label: 'Pixel da Meta', status: cfg.meta_pixel_id ? 'Configurado' : 'Opcional', tone: cfg.meta_pixel_id ? 'ok' : 'off' },
      { id: 'googleads', label: 'Google Ads', status: aux.ads ? 'Conectado' : 'Opcional', tone: aux.ads ? 'ok' : 'off' },
      { id: 'links', label: 'Links rastreados', status: aux.links > 0 ? `${aux.links} ${aux.links === 1 ? 'link' : 'links'}` : 'Opcional', tone: aux.links > 0 ? 'ok' : 'off' },
    ] },
    { title: 'Cobrar o cliente', items: [{ id: 'asaas', label: 'Asaas', status: aux.asaas ? 'Conectado' : 'Opcional', tone: aux.asaas ? 'ok' : 'off' }] },
  ], [connected, stale, resumo?.lastMessageAt, meta, aux, cfg.meta_ad_account_id, cfg.meta_pixel_id]);

  const all = groups.flatMap((g) => g.items);
  const active = all.filter((i) => i.tone !== 'off').length;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-stretch">
      <aside className={cn(CARD, 'flex w-full shrink-0 flex-col gap-2 p-6 xl:w-[380px]')}>
        <div className="flex flex-col gap-2 pb-2"><h3 className="text-xl font-semibold text-foreground">Conexões</h3><p className="text-[15px] leading-[150%] text-muted-foreground">Tudo o que a {agent} usa para funcionar. {active} {active === 1 ? 'ativa' : 'ativas'}, {all.length - active} {all.length - active === 1 ? 'opcional' : 'opcionais'}.</p></div>
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5 pt-2">
            <p className="px-3.5 pb-1 text-[13px] font-semibold text-foreground">{g.title}</p>
            {g.items.map((it) => (
              <button key={it.id} type="button" aria-current={sub === it.id ? 'true' : undefined} onClick={() => onSub(it.id)} className={cn('flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-colors', sub === it.id ? 'bg-[#E4F1E9] dark:bg-[#12301F]' : 'hover:bg-muted')}>
                <span className={cn('text-[15px] text-foreground', sub === it.id && 'font-semibold')}>{it.label}</span>
                <span className={cn('flex items-center gap-2 text-sm', it.tone === 'off' ? 'text-muted-foreground' : 'text-foreground/85')}>{it.tone !== 'off' && <span className={cn('h-2 w-2 rounded-full', it.tone === 'warn' ? 'bg-amber-500' : 'bg-[#01573C] dark:bg-[#96F63C]')} />}{it.status}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className={cn(CARD, 'min-w-0 flex-1 px-10 py-9')}>
        {sub === 'whatsapp' && <WhatsAppPanel cfg={cfg} agent={agent} resumo={resumo} reload={reloadAll} go={onSub} />}
        {sub === 'metaapi' && <MetaApiPanel cfg={cfg} agent={agent} reload={reloadAll} />}
        {sub === 'calendar' && <CalendarPanel cfg={cfg} agent={agent} save={save} />}
        {sub === 'horario' && <HorarioPanel agent={agent} />}
        {sub === 'metaads' && <MetaAdsPanel cfg={cfg} reload={reloadAll} />}
        {sub === 'pixel' && <PixelPanel cfg={cfg} resumo={resumo} save={save} />}
        {sub === 'googleads' && <GoogleAdsPanel resumo={resumo} />}
        {sub === 'links' && <LinksPanel resumo={resumo} />}
        {sub === 'asaas' && <AsaasPanel cfg={cfg} agent={agent} companyId={companyId} save={save} />}
      </section>
    </div>
  );
}
