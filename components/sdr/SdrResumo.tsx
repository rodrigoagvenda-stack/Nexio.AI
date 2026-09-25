'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { CARD, LIME, Toggle } from './ui';
import type { SdrCfg } from './useSdrConfig';

export type SdrGo = (tab: 'conversa' | 'conhecimento' | 'conexoes', sub?: string) => void;

interface Resumo {
  lastMessageAt: string | null;
  agentMessages30: number; inbound30: number; team30: number;
  conversations30: number; conversationsAgentOn30: number;
  handoffs7: number; blocked7: number; blockedLastAt: string | null;
  knowledgeChunks: number;
  funnel: { steps: number; objections: number } | null;
}

const fmt = (n: number) => n.toLocaleString('pt-BR');
const dm = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const hm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

export function SdrResumo({ cfg, funnelOn, onToggleAgent, onGo }: { cfg: SdrCfg; funnelOn: boolean; onToggleAgent: (v: boolean) => Promise<void>; onGo: SdrGo }) {
  const [data, setData] = useState<Resumo | null>(null);
  const [failed, setFailed] = useState(false);
  const [google, setGoogle] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [ads, setAds] = useState<{ connected: boolean } | null>(null);
  const [asaas, setAsaas] = useState<boolean | null>(null);
  const [always, setAlways] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const json = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    fetch('/api/sdr/resumo').then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setData).catch(() => setFailed(true));
    void json('/api/google/status').then((d) => setGoogle(d ? { connected: !!d.connected, email: d.email ?? null } : { connected: false, email: null }));
    void json('/api/google-ads/status').then((d) => setAds({ connected: !!d?.connected }));
    void json('/api/payment-integrations').then((d) => setAsaas(((d?.integrations ?? []) as { platform: string; active: boolean }[]).some((i) => i.platform === 'asaas' && i.active)));
    void json('/api/business-hours').then((d) => setAlways(!!d?.ativo24h));
  }, []);

  const connected = cfg.instance_status === 'connected';
  const agentName = cfg.persona.nome_agente || 'Agente SDR';
  const subtitle = cfg.agent_type === 'atendimento_venda_agendamento' ? 'Atendimento, venda e agendamento' : 'Atendimento e venda';

  const attention: { title: string; text: string }[] = [];
  if (!cfg.agente_ativo) attention.push({ title: 'O agente está desligado', text: 'Enquanto estiver desligado, ninguém responde os leads pelo WhatsApp. Ligue no topo desta tela.' });
  if (!connected) attention.push({ title: 'O WhatsApp não está conectado', text: 'O agente não recebe nem envia mensagens. Reconecte em Conexões.' });
  if (data?.lastMessageAt && connected && Date.now() - new Date(data.lastMessageAt).getTime() > 48 * 3_600_000) {
    attention.push({ title: `Nenhuma mensagem desde ${dm(data.lastMessageAt)} às ${hm(data.lastMessageAt)}`, text: 'Nada chegou nem saiu nos últimos dias, embora o WhatsApp conste como conectado.' });
  }
  if (data && data.blocked7 > 0) {
    attention.push({ title: `A revisão automática barrou ${plural(data.blocked7, 'resposta', 'respostas')} em 7 dias`, text: `${data.blockedLastAt ? `A última foi em ${dm(data.blockedLastAt)}. ` : ''}O lead não recebeu ${data.blocked7 === 1 ? 'essa resposta' : 'essas respostas'}.` });
  }

  const stats: [string, string][] = data ? [
    ['Mensagens enviadas pelo agente', fmt(data.agentMessages30)],
    ['Mensagens recebidas de leads', fmt(data.inbound30)],
    ['Mensagens enviadas por pessoas da equipe', fmt(data.team30)],
    [`Conversas com o agente ativo (de ${fmt(data.conversations30)})`, fmt(data.conversationsAgentOn30)],
    ['Passagens para a equipe, nos últimos 7 dias', fmt(data.handoffs7)],
  ] : [];

  const setup: { ok: boolean; title: string; sub: string; action: string; go: () => void }[] = [
    { ok: connected, title: connected ? 'WhatsApp conectado' : 'WhatsApp não conectado', sub: connected ? (cfg.whatsapp_provider === 'meta' ? 'Pela API oficial da Meta' : 'Por QR code') : 'Conecte para o agente atender', action: connected ? 'Conexões' : 'Conectar', go: () => onGo('conexoes', 'whatsapp') },
    { ok: !!data?.funnel && data.funnel.steps > 0, title: 'Roteiro de perguntas', sub: data?.funnel ? `${plural(data.funnel.steps, 'pergunta', 'perguntas')} e ${plural(data.funnel.objections, 'objeção ou dúvida', 'objeções e dúvidas')}` : 'Ainda sem roteiro', action: 'Conversa', go: () => onGo('conversa') },
    { ok: (data?.knowledgeChunks ?? 0) > 0, title: 'Base de conhecimento', sub: data && data.knowledgeChunks > 0 ? plural(data.knowledgeChunks, 'trecho de conhecimento', 'trechos de conhecimento') : 'Ainda vazia', action: 'Conhecimento', go: () => onGo('conhecimento') },
    { ok: !!google?.connected, title: google?.connected ? 'Google Calendar conectado' : 'Google Calendar', sub: google?.connected ? (google.email ?? 'Agenda conectada') : 'Opcional. Não conectado.', action: google?.connected ? 'Conexões' : 'Conectar', go: () => onGo('conexoes', 'calendar') },
    { ok: !!(cfg.meta_ad_account_id || cfg.meta_pixel_id), title: 'Meta: conta de anúncios e pixel', sub: cfg.meta_ad_account_name ? `Conta ${cfg.meta_ad_account_name}` : cfg.meta_pixel_id ? 'Pixel conectado' : 'Opcional. Não conectado.', action: cfg.meta_ad_account_id || cfg.meta_pixel_id ? 'Conexões' : 'Conectar', go: () => onGo('conexoes', 'meta') },
    { ok: true, title: always ? 'Atende 24 horas' : 'Atende em horário definido', sub: always ? 'Sem horário de ausência' : 'Fora do horário, o agente avisa o lead', action: 'Conexões', go: () => onGo('conexoes', 'horario') },
    { ok: !!asaas, title: 'Cobrança automática pelo Asaas', sub: asaas ? 'Conectado' : 'Opcional. Não conectado.', action: asaas ? 'Conexões' : 'Conectar', go: () => onGo('conexoes', 'asaas') },
    { ok: !!ads?.connected, title: 'Google Ads', sub: ads?.connected ? 'Conectado' : 'Opcional. Não conectado.', action: ads?.connected ? 'Conexões' : 'Conectar', go: () => onGo('conexoes', 'googleads') },
  ];

  async function toggle(v: boolean) {
    setToggling(true);
    try { await onToggleAgent(v); toast({ title: v ? 'Agente ligado' : 'Agente desligado', variant: 'success' }); } finally { setToggling(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={cn(CARD, 'flex flex-wrap items-center justify-between gap-6 px-7 py-6')}>
        <div className="flex items-center gap-5">
          <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-full bg-[#E4F1E9] text-[26px] font-semibold text-[#01573C] dark:bg-[#12301F] dark:text-[#96F63C]">{agentName.charAt(0).toUpperCase()}</span>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-2xl font-semibold leading-8 tracking-tight text-foreground">{agentName}</h2>
              <span className="text-[15px] text-muted-foreground">{subtitle}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-foreground/85">
              {[
                [connected, connected ? 'WhatsApp conectado' : 'WhatsApp desconectado'],
                [true, funnelOn ? 'SDR Guiado' : 'SDR Autônomo'],
                [!!always, always ? 'Atende 24 horas' : 'Atende em horário definido'],
              ].map(([ok, label]) => (
                <span key={label as string} className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', ok ? 'bg-[#01573C] dark:bg-[#96F63C]' : 'bg-amber-500')} />{label as string}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-semibold text-foreground">{cfg.agente_ativo ? 'Agente ligado' : 'Agente desligado'}</span>
          {toggling ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Toggle on={cfg.agente_ativo} onChange={toggle} label="Ligar ou desligar o agente" />}
        </div>
      </section>

      {failed ? (
        <p className="py-16 text-center text-muted-foreground">Não foi possível carregar o resumo agora. Tente de novo em instantes.</p>
      ) : (
        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-8">
            <section className="flex flex-col gap-3.5">
              <h3 className="text-xl font-semibold text-foreground">Precisa de atenção</h3>
              <div className={cn(CARD, 'flex flex-col')}>
                {!data ? (
                  <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : attention.length === 0 ? (
                  <p className="px-6 py-6 text-[15px] text-muted-foreground">Nada pedindo atenção agora.</p>
                ) : attention.map((a, i) => (
                  <div key={a.title} className={cn('flex flex-col gap-1.5 px-6 py-5', i > 0 && 'border-t border-border')}>
                    <p className="flex items-center gap-3 text-base font-semibold text-foreground"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{a.title}</p>
                    <p className="pl-[18px] text-[15px] text-muted-foreground">{a.text}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="flex flex-col gap-3.5">
              <h3 className="text-xl font-semibold text-foreground">Últimos 30 dias</h3>
              <div className={cn(CARD, 'flex flex-col')}>
                {!data ? (
                  <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : stats.map(([k, v], i) => (
                  <div key={k} className={cn('flex items-center justify-between gap-4 px-6 py-[18px]', i > 0 && 'border-t border-border')}>
                    <span className="text-[15px] text-foreground/90">{k}</span>
                    <span className="text-xl font-semibold tabular-nums text-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="flex w-full shrink-0 flex-col gap-3.5 xl:w-[600px]">
            <h3 className="text-xl font-semibold text-foreground">Configuração</h3>
            <div className={cn(CARD, 'flex flex-col')}>
              {setup.map((s, i) => (
                <div key={s.title} className={cn('flex items-center gap-4 px-6 py-4', i > 0 && 'border-t border-border')}>
                  {s.ok
                    ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E4F1E9] dark:bg-[#12301F]"><Check className={cn('h-4 w-4', LIME)} strokeWidth={2.6} /></span>
                    : <span className="h-8 w-8 shrink-0 rounded-full border-[1.5px] border-dashed border-muted-foreground/50" />}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-[15px] font-semibold text-foreground">{s.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{s.sub}</p>
                  </div>
                  <button type="button" onClick={s.go} className={cn('shrink-0 text-sm font-semibold hover:underline', LIME)}>{s.action}</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
