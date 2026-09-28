'use client';

import { useEffect, useRef, useState } from 'react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { HeroConversa } from './demos/HeroConversa';
import { DemoCanvas } from './demos/DemoCanvas';
import { DemoKanban } from './demos/DemoKanban';

// Painel de slides da tela de login. Desenhado em um palco fixo de 1280x1080 (medidas do Paper)
// que é escalado para caber na área disponível, então o layout fica idêntico em qualquer tela.
// As 3 animações são os componentes de verdade do site (zaapply.com.br): a primeira dobra (balões
// de conversa), a seção "Monte o follow-up uma vez. Ele roda sozinho" (canvas) e "Todos os seus
// leads em um quadro só" (kanban) — mesmo código, não uma reinterpretação.
const DESIGN_W = 1280;
const DESIGN_H = 1080;
const SLIDE_MS = 9000;

const SYS = 'system-ui, sans-serif';

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

/* ───────── Palco ───────── */

const SLIDES = [
  {
    title: 'Atenda em segundos, a qualquer hora.',
    sub: 'O agente responde, qualifica e marca a reunião enquanto você cuida do resto.',
    visual: (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <HeroConversa />
      </div>
    ),
  },
  {
    title: 'Monte o follow-up uma vez. Ele roda sozinho.',
    sub: 'Monte a sequência com gatilho, mensagens e esperas. Quem responde sai da sequência, sem ninguém lembrar de cobrar.',
    visual: <DemoCanvas />,
  },
  {
    title: 'Todos os seus leads em um quadro só.',
    sub: 'Veja em que etapa está cada negociação e mova com um arrasto.',
    visual: <DemoKanban />,
  },
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
      style={{ background: '#F5F7F6', borderRight: '1px solid #E2E7E4' }}
    >
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
              style={{
                position: 'absolute', inset: 0, padding: '56px 72px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                opacity: i === idx ? 1 : 0, transition: 'opacity .6s ease', pointerEvents: i === idx ? 'auto' : 'none',
              }}
            >
              <div style={{ height: 34 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 720 }}>
                  <div style={{ color: '#0E1512', fontFamily: SYS, fontSize: 44, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: '50px' }}>{s.title}</div>
                  <div style={{ color: '#5B6660', fontFamily: SYS, fontSize: 18, lineHeight: '27px' }}>{s.sub}</div>
                </div>
                <div>{s.visual}</div>
              </div>
              <div style={{ height: 6 }} />
            </div>
          ))}

          <div style={{ position: 'absolute', left: 72, top: 56 }}>
            <ZaapliLogo variant="full" iconSize={34} theme="light" />
          </div>
          <div style={{ position: 'absolute', left: 72, bottom: 56, display: 'flex', alignItems: 'center', gap: 8 }}>
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIdx(i)}
                style={{ width: i === idx ? 24 : 6, height: 6, borderRadius: 3, background: i === idx ? '#01573C' : '#D5DDD9', border: 0, padding: 0, cursor: 'pointer', transition: 'width .3s ease, background .3s ease' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
