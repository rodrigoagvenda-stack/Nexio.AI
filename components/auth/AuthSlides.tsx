'use client';

import { useEffect, useRef, useState } from 'react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';

// Painel de slides da tela de login. Desenhado em um palco fixo de 1280x1080 (medidas do Paper)
// que é escalado para caber na área disponível, então o layout fica idêntico em qualquer tela.
const DESIGN_W = 1280;
const DESIGN_H = 1080;
const SLIDE_MS = 9000;

const SYS = 'system-ui, sans-serif';
const INTER = '"Inter", system-ui, sans-serif';

function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ s: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const s = Math.min(w / DESIGN_W, h / DESIGN_H);
      setFit({ s, x: (w - DESIGN_W * s) / 2, y: (h - DESIGN_H * s) / 2 });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, fit };
}

/* ───────── Slide 1: atendimento ───────── */

const CHAT: { from: 'lead' | 'sdr'; text: string; time: string }[] = [
  { from: 'lead', text: 'Oi, vi o anúncio de vocês. Como funciona?', time: '02:14' },
  { from: 'sdr', text: 'Oi! Vou te explicar rapidinho. Você já atende seus clientes pelo WhatsApp hoje?', time: '02:14' },
  { from: 'lead', text: 'Sim, mas perco muita mensagem à noite', time: '02:15' },
  { from: 'sdr', text: 'Faz sentido. Quer 15 minutos amanhã para eu te mostrar?', time: '02:15' },
  { from: 'lead', text: 'Pode ser às 10h', time: '02:16' },
  { from: 'sdr', text: 'Combinado! Reunião marcada para amanhã às 10h.', time: '02:16' },
];

const stroke = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function BotIcon({ size, color, antenna = true }: { size: number; color: string; antenna?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect x="4" y="8" width="16" height="12" rx="3" stroke={color} {...stroke} />
      <path d={antenna ? 'M12 8V4M9 14h.01M15 14h.01' : 'M12 8V4'} stroke={color} {...stroke} />
    </svg>
  );
}

function ChatMock() {
  return (
    <div style={{ alignSelf: 'flex-end', width: 852, background: '#0C0C0C', border: '1px solid #1A1A1A', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #1A1A1A' }}>
        <div style={{ width: 42, height: 42, borderRadius: 999, background: '#01573C2E', color: '#34B270', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: INTER, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>MC</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: '#FAFAFA', fontFamily: INTER, fontSize: 16, fontWeight: 600, lineHeight: '20px' }}>Marina Costa</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: '#34B2701F', color: '#34B270', borderRadius: 6, height: 20, padding: '0 8px', display: 'flex', alignItems: 'center', fontFamily: INTER, fontSize: 11, fontWeight: 600 }}>Interessado</span>
            <span style={{ background: '#F973161F', color: '#FB923C', borderRadius: 6, height: 20, padding: '0 8px', display: 'flex', alignItems: 'center', fontFamily: INTER, fontSize: 11, fontWeight: 600 }}>Quente</span>
            <span style={{ color: '#5C5C5C', fontFamily: INTER, fontSize: 12 }}>Sem valor</span>
            <span style={{ color: '#5C5C5C', fontFamily: INTER, fontSize: 12 }}>Entrou hoje</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ color: '#5C5C5C', fontFamily: INTER, fontSize: 11, lineHeight: '14px' }}>Quem responde nesta conversa</div>
          <div style={{ display: 'flex', alignItems: 'center', padding: 3, background: '#141414', border: '1px solid #1A1A1A', borderRadius: 999 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 14px', borderRadius: 999, background: '#0F3D2B', color: '#fff', fontFamily: INTER, fontSize: 12, fontWeight: 600 }}>
              <BotIcon size={14} color="#FFFFFF" />
              SDR
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 14px', borderRadius: 999, color: '#999', fontFamily: INTER, fontSize: 12, fontWeight: 500 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="8" r="4" stroke="#999999" {...stroke} />
                <path d="M4 21c0-4 4-6 8-6s8 2 8 6" stroke="#999999" {...stroke} />
              </svg>
              Você
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '20px 24px', background: '#0C0C0C' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{ background: '#141414', color: '#999', borderRadius: 999, height: 22, padding: '0 12px', display: 'flex', alignItems: 'center', fontFamily: INTER, fontSize: 11 }}>Hoje</span>
        </div>
        {CHAT.map((m, i) =>
          m.from === 'lead' ? (
            <div key={i} className="zl-in" style={{ display: 'flex', ['--d' as string]: `${0.5 + i * 1.1}s` }}>
              <div style={{ maxWidth: '62%', display: 'flex', alignItems: 'flex-end', gap: 10, background: '#1A1A1A', padding: '10px 14px', borderRadius: '14px 14px 14px 4px' }}>
                <span style={{ color: '#EDEDED', fontFamily: INTER, fontSize: 13.5, lineHeight: '19.5px' }}>{m.text}</span>
                <span style={{ color: '#999', fontFamily: INTER, fontSize: 10.5, lineHeight: '14px' }}>{m.time}</span>
              </div>
            </div>
          ) : (
            <div key={i} className="zl-in" style={{ display: 'flex', justifyContent: 'flex-end', ['--d' as string]: `${0.5 + i * 1.1}s` }}>
              <div style={{ maxWidth: '62%', display: 'flex', flexDirection: 'column', gap: 4, background: '#01573C52', border: '1px solid #01573C80', padding: '10px 14px', borderRadius: '14px 14px 4px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BotIcon size={11} color="#96F63C" antenna={false} />
                  <span style={{ color: '#96F63C', fontFamily: INTER, fontSize: 11, fontWeight: 600, lineHeight: '14px' }}>SDR</span>
                </div>
                <span style={{ color: '#EDEDED', fontFamily: INTER, fontSize: 13.5, lineHeight: '19.5px' }}>{m.text}</span>
                <span style={{ alignSelf: 'flex-end', color: '#7A9A8A', fontFamily: INTER, fontSize: 10.5, lineHeight: '14px' }}>{m.time}</span>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/* ───────── Slide 2: canvas de automações ───────── */

const NODE_BASE = { position: 'absolute', boxSizing: 'border-box' } as const;

function Handle({ left, on }: { left: number; on?: boolean }) {
  return (
    <div style={{ ...NODE_BASE, left, top: 127, width: 12, height: 12, borderRadius: 999, border: on ? '2px solid #0B0B0B' : '2px solid #7A7A7A', background: on ? '#96F63C' : '#0B0B0B' }} />
  );
}

function Link({ left }: { left: number }) {
  return <div style={{ ...NODE_BASE, left, top: 133, width: 112, height: 2, background: '#3A3A3A' }} />;
}

function DelayPill({ left, label }: { left: number; label: string }) {
  return (
    <div style={{ ...NODE_BASE, left, top: 121, width: 80, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, background: '#141414', border: '1px solid #2E2E2E', borderRadius: 999 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="#A3A3A3" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 7v5l3 2" fill="none" stroke="#A3A3A3" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span style={{ color: '#D0D0D0', fontFamily: SYS, fontSize: 12, fontWeight: 500 }}>{label}</span>
    </div>
  );
}

const MSGS = [
  { left: 312, title: 'Mensagem 1', sub: 'Dia 0 · Áudio', body: 'Oi {nome}! Vi que você tinha começado a falar sobre {produto}…', audio: true, active: true },
  { left: 632, title: 'Mensagem 2', sub: 'Dia 2 · Texto', body: '{nome}, sei que a rotina aperta! Só reforçando: o diagnóstico…', audio: false, active: false },
  { left: 952, title: 'Mensagem 3', sub: 'Dia 5 · Texto', body: '{nome}, entendo se o motivo for o investimento ou a dúvida…', audio: false, active: false },
];

function CanvasMock() {
  return (
    <div style={{ position: 'relative', width: 1160, height: 236, flexShrink: 0 }}>
      <div className="zl-in" style={{ ...NODE_BASE, left: 364, top: 0, width: 104, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 10px', background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 999, ['--d' as string]: '1.9s' }}>
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="#FAFAFA" /></svg>
        <svg width="16" height="16" viewBox="0 0 24 24">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="#FAFAFA" {...stroke} />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" stroke="#FAFAFA" {...stroke} />
        </svg>
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="#F87171" {...stroke} /></svg>
      </div>

      <div className="zl-in" style={{ ...NODE_BASE, left: 0, top: 92, width: 200, height: 84, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: '#141414', border: '1.5px solid #2E2E2E', borderRadius: 16, ['--d' as string]: '0.3s' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F5B54424', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" stroke="#F5B544" {...stroke} /></svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ color: '#8A8A8A', fontFamily: SYS, fontSize: 12, lineHeight: '16px' }}>Gatilho</span>
          <span style={{ color: '#FAFAFA', fontFamily: SYS, fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>Etiqueta Follow up</span>
        </div>
      </div>

      {[0, 1, 2].map((i) => {
        const m = MSGS[i];
        const linkLeft = i === 0 ? 200 : m.left - 112;
        const delayLabel = ['Agora', '2 dias', '3 dias'][i];
        const pillLeft = i === 0 ? 216 : m.left - 96;
        return (
          <div key={m.left}>
            <div className="zl-in" style={{ ['--d' as string]: `${0.7 + i * 0.5}s` }}>
              <Link left={linkLeft} />
              <Handle left={linkLeft - 6} on={i === 1} />
              <Handle left={linkLeft + 106} />
              <DelayPill left={pillLeft} label={delayLabel} />
            </div>
            <div
              className="zl-in"
              style={{
                ...NODE_BASE, left: m.left, top: 50, width: 208, height: 168, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
                background: '#141414', borderRadius: 16,
                border: m.active ? '1.5px solid #96F63C' : '1.5px solid #2E2E2E',
                boxShadow: m.active ? '0 0 0 4px #96F63C1A' : undefined,
                ['--d' as string]: `${0.9 + i * 0.5}s`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#96F63C24', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.audio ? (
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <rect x="9" y="2" width="6" height="12" rx="3" stroke="#96F63C" {...stroke} />
                      <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" stroke="#96F63C" {...stroke} />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#96F63C" {...stroke} /></svg>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#FAFAFA', fontFamily: SYS, fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>{m.title}</span>
                  <span style={{ color: '#8A8A8A', fontFamily: SYS, fontSize: 12, lineHeight: '16px' }}>{m.sub}</span>
                </div>
              </div>
              <div style={{ flex: 1, background: '#1E1E1E', borderRadius: 10, padding: '10px 12px' }}>
                <span style={{ color: '#E4E4E4', fontFamily: SYS, fontSize: 13, lineHeight: '19px' }}>{m.body}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Slide 3: CRM em quadro ───────── */

type Tag = 'Quente' | 'Alta' | 'Média';
type Meta = { text: string; live?: boolean };
type KCard = { i: string; name: string; tags?: Tag[]; value: string; meta: Meta };

const TAG_STYLE: Record<Tag, { bg: string; fg: string }> = {
  Quente: { bg: '#F973161F', fg: '#FB923C' },
  Alta: { bg: '#EF44441F', fg: '#F87171' },
  Média: { bg: '#FFFFFF14', fg: '#D8D8D8' },
};

const COLUMNS: { name: string; color: string; count: number; total: string; cards: KCard[] }[] = [
  { name: 'Lead novo', color: '#3B82F6', count: 3, total: 'R$ 5.900', cards: [
    { i: 'MC', name: 'Marina Costa', value: 'R$ 2.200', meta: { text: 'Nós falamos há 2d' } },
    { i: 'RL', name: 'Rafael Lima', value: 'R$ 1.500', meta: { text: 'Nós falamos há 2d' } },
    { i: 'CR', name: 'Camila Rocha', value: 'R$ 2.200', meta: { text: 'Nós falamos há 3d' } },
  ] },
  { name: 'Em contato', color: '#EC4899', count: 2, total: 'R$ 5.600', cards: [
    { i: 'BA', name: 'Bruno Alves', tags: ['Quente'], value: 'R$ 2.200', meta: { text: 'Nós falamos há 2d' } },
    { i: 'PM', name: 'Paula Mendes', value: 'R$ 3.400', meta: { text: 'Nós falamos há 1d' } },
  ] },
  { name: 'Interessado', color: '#34B270', count: 2, total: 'R$ 4.000', cards: [
    { i: 'JP', name: 'Juliana Prado', tags: ['Quente', 'Alta'], value: 'R$ 2.200', meta: { text: 'Lead falou há 2d', live: true } },
    { i: 'DN', name: 'Diego Nunes', value: 'R$ 1.800', meta: { text: 'Nós falamos há 2d' } },
  ] },
  { name: 'Proposta enviada', color: '#38BDF8', count: 2, total: 'R$ 7.480', cards: [
    { i: 'FD', name: 'Felipe Duarte', tags: ['Quente', 'Média'], value: 'R$ 5.280', meta: { text: 'Nós falamos há 2d' } },
    { i: 'RS', name: 'Renata Souza', value: 'R$ 2.200', meta: { text: 'Lead falou há 1d', live: true } },
  ] },
  { name: 'Fechado', color: '#84CC16', count: 2, total: 'R$ 3.200', cards: [
    { i: 'LF', name: 'Lucas Ferraz', value: 'R$ 2.200', meta: { text: 'Fechou em 21 set', live: true } },
    { i: 'AB', name: 'Aline Batista', value: 'R$ 1.000', meta: { text: 'Fechou em 08 set', live: true } },
  ] },
];

function KanbanMock() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {COLUMNS.map((c, ci) => (
        <div key={c.name} className="zl-in" style={{ width: 216, flexShrink: 0, boxSizing: 'border-box', background: '#101010', border: '1px solid #1A1A1A', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8, ['--d' as string]: `${0.3 + ci * 0.25}s` }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 2px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: c.color, flexShrink: 0 }} />
                <span style={{ color: '#FAFAFA', fontFamily: INTER, fontSize: 13, fontWeight: 600, lineHeight: '16px' }}>{c.name}</span>
              </div>
              <span style={{ background: '#1A1A1A', color: '#D8D8D8', borderRadius: 999, height: 20, padding: '0 8px', display: 'flex', alignItems: 'center', fontFamily: INTER, fontSize: 11, fontWeight: 600 }}>{c.count}</span>
            </div>
            <span style={{ paddingLeft: 16, color: '#999', fontFamily: INTER, fontSize: 12, lineHeight: '16px' }}>{c.total}</span>
          </div>
          {c.cards.map((k) => (
            <div key={k.name} style={{ background: '#141414', border: '1px solid #1A1A1A', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: '#01573C2E', color: '#34B270', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: INTER, fontSize: 11, fontWeight: 700 }}>{k.i}</span>
                <span style={{ color: '#FAFAFA', fontFamily: INTER, fontSize: 13, fontWeight: 600, lineHeight: '16px' }}>{k.name}</span>
              </div>
              {k.tags && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {k.tags.map((t) => (
                    <span key={t} style={{ background: TAG_STYLE[t].bg, color: TAG_STYLE[t].fg, borderRadius: 6, height: 20, padding: '0 8px', display: 'flex', alignItems: 'center', fontFamily: INTER, fontSize: 11, fontWeight: 600 }}>{t}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#D8D8D8', fontFamily: INTER, fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>{k.value}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: k.meta.live ? '#34B270' : '#5C5C5C', flexShrink: 0 }} />
                  <span style={{ color: k.meta.live ? '#34D399' : '#999', fontFamily: INTER, fontSize: 11, lineHeight: '14px' }}>{k.meta.text}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ───────── Palco ───────── */

const SLIDES = [
  { title: 'Atenda em segundos, a qualquer hora.', sub: 'O agente responde, qualifica e marca a reunião enquanto você cuida do resto.', gap: 56, visual: <ChatMock /> },
  { title: 'Monte suas automações arrastando.', sub: 'Follow-up, lembretes e recuperação de clientes, sem escrever código.', gap: 48, visual: <CanvasMock /> },
  { title: 'Todos os seus leads em um quadro só.', sub: 'Veja em que etapa cada negociação está e mova com um arrasto.', gap: 48, visual: <KanbanMock /> },
];

export function AuthSlides() {
  const { ref, fit } = useFit();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [idx]);

  return (
    <div
      ref={ref}
      className="relative hidden xl:block flex-1 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0E0E0E 0%, #121212 100%)' }}
    >
      <style>{`
        .zl-in { opacity: 0; }
        .zl-on .zl-in { animation: zl-in .55s ease-out forwards; animation-delay: var(--d, 0s); }
        @keyframes zl-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .zl-in { opacity: 1 !important; animation: none !important; } }
      `}</style>
      {fit && (
        <div
          style={{
            position: 'absolute', left: fit.x, top: fit.y, width: DESIGN_W, height: DESIGN_H,
            transform: `scale(${fit.s})`, transformOrigin: 'top left',
          }}
        >
          {SLIDES.map((s, i) => (
            <div
              key={s.title}
              className={i === idx ? 'zl-on' : ''}
              style={{
                position: 'absolute', inset: 0, padding: '56px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                opacity: i === idx ? 1 : 0, transition: 'opacity .6s ease', pointerEvents: i === idx ? 'auto' : 'none',
              }}
            >
              <div style={{ height: 34 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: s.gap }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
                  <div style={{ color: '#F5F5F5', fontFamily: SYS, fontSize: 54, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: '60px' }}>{s.title}</div>
                  <div style={{ color: '#8A8A8A', fontFamily: SYS, fontSize: 20, lineHeight: '30px' }}>{s.sub}</div>
                </div>
                {s.visual}
              </div>
              <div style={{ height: 6 }} />
            </div>
          ))}

          <div style={{ position: 'absolute', left: 72, top: 56 }}>
            <ZaapliLogo variant="full" iconSize={34} theme="dark" />
          </div>
          <div style={{ position: 'absolute', left: 72, bottom: 56, display: 'flex', alignItems: 'center', gap: 8 }}>
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIdx(i)}
                style={{ width: i === idx ? 24 : 6, height: 6, borderRadius: 3, background: i === idx ? '#F5F5F5' : '#3A3A3A', border: 0, padding: 0, cursor: 'pointer', transition: 'width .3s ease, background .3s ease' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
