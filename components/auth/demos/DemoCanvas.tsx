'use client';

import { Check } from 'lucide-react';
import { PaperCanvas } from './PaperCanvas';
import { ScaledStage } from './ScaledStage';
import { useTimeline } from './useTimeline';

/** Instantes (ms): cada passo da sequência é executado na ordem, do gatilho até a mensagem 4. */
const TIMES = [0, 800, 2000, 3200, 4400, 5600, 7200] as const;

const STEP_LABELS = [
  'Você desenha a sequência no canvas',
  'O sistema executa cada passo sozinho',
  'Quem responde sai da sequência',
];

const FONT = "font-['Inter',system-ui,sans-serif]";
const PAD = 16;

// Posição de cada cartão dentro do editor (medidas do Paper).
const NODES = [
  { x: 49, y: 384, w: 200, h: 84 },
  { x: 361, y: 342, w: 208, h: 168 },
  { x: 681, y: 342, w: 208, h: 168 },
  { x: 1001, y: 342, w: 208, h: 168 },
  { x: 1321, y: 342, w: 208, h: 168 },
];

export function DemoCanvas() {
  const { ref, step } = useTimeline(TIMES, 3500);
  const activeChip = step >= 5 ? 2 : step >= 2 ? 1 : 0;

  return (
    <div ref={ref} className="flex flex-col gap-10">
      <div className="mx-auto grid w-full max-w-[1248px] gap-3 md:grid-cols-3">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-2xl border px-[18px] py-3.5 transition-colors duration-300 ${
              i === activeChip ? 'border-[#BFD9CB] bg-[#E6F1EB]' : 'border-[#E2E7E4] bg-white'
            }`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${i === activeChip ? 'bg-[#01573C] text-white' : 'bg-[#EEF2F0] text-[#5B6660]'}`}>{i + 1}</span>
            <span className={`text-sm leading-5 ${i === activeChip ? 'font-semibold text-[#0E1512]' : 'text-[#5B6660]'}`}>{label}</span>
          </div>
        ))}
      </div>

      <ScaledStage width={1680} height={790} label="Canvas de automação do Zaapply: gatilho e mensagens em sequência, executados um a um">
        <div className={`${FONT} relative h-[790px] w-[1680px] overflow-hidden rounded-2xl border border-solid border-[#E2E7E4] bg-[#F5F7F6] shadow-[0_24px_60px_rgba(14,21,18,0.10)]`} style={{ padding: PAD }}>
          <div className="relative h-[758px] w-[1648px]">
            <PaperCanvas />
            {NODES.map((n, i) => {
              const done = step > i + 1 || (step === 6 && i < 5);
              const active = step === i + 1;
              return (
                <div key={i} className="pointer-events-none absolute" style={{ left: n.x, top: n.y, width: n.w, height: n.h }}>
                  <div
                    className="absolute inset-0 rounded-2xl transition-all duration-300"
                    style={{
                      boxShadow: active ? '0 0 0 2px #01573C, 0 0 0 6px rgba(1,87,60,0.14)' : 'none',
                      opacity: active ? 1 : 0,
                    }}
                  />
                  <span
                    className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#01573C] text-white transition-all duration-300"
                    style={{ opacity: done || active ? 1 : 0, transform: done || active ? 'scale(1)' : 'scale(0.4)' }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </ScaledStage>
    </div>
  );
}
