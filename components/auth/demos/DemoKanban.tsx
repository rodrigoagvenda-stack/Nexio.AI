'use client';

import { PaperKanban } from './PaperKanban';
import { ScaledStage } from './ScaledStage';
import { useTimeline } from './useTimeline';

/** Instantes (ms): 0 quadro parado, 1 cursor pega o card, 2 arrasta, 3 solta e os totais se ajustam. */
const TIMES = [0, 1200, 2600, 4400, 5200] as const;

const STEP_LABELS = [
  'O lead entra sozinho no quadro',
  'Arraste o card para a próxima etapa',
  'Os totais de cada etapa se atualizam',
];

const FONT = "font-['Inter',system-ui,sans-serif]";
const PAD = 16;

export function DemoKanban() {
  const { ref, step } = useTimeline(TIMES, 3500);
  const fase = Math.min(step, 3);
  const activeChip = fase >= 3 ? 2 : fase >= 1 ? 1 : 0;
  const cursor =
    fase >= 2 ? { left: PAD + 20 + 332 + 150, top: PAD + 250 + 30 } : fase === 1 ? { left: PAD + 20 + 150, top: PAD + 250 + 26 } : { left: PAD + 900, top: PAD + 330 };

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
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                i === activeChip ? 'bg-[#01573C] text-white' : 'bg-[#EEF2F0] text-[#5B6660]'
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-sm leading-5 ${i === activeChip ? 'font-semibold text-[#0E1512]' : 'text-[#5B6660]'}`}>{label}</span>
          </div>
        ))}
      </div>

      <ScaledStage width={1696} height={620} label="Tela do CRM Kanban do Zaapply: o card de um lead é arrastado para a próxima etapa do funil">
        <div className={`${FONT} relative h-[620px] w-[1696px] overflow-hidden rounded-2xl border border-solid border-[#E2E7E4] bg-[#F5F7F6] shadow-[0_24px_60px_rgba(14,21,18,0.10)]`} style={{ padding: PAD }}>
          <PaperKanban fase={fase} />

          {step === 3 && (
            <span key="ripple" className="demo-ripple pointer-events-none absolute h-11 w-11 rounded-full border-2 border-solid border-[#01573C]/50 bg-[#01573C]/20" style={{ left: cursor.left - 18, top: cursor.top - 14 }} />
          )}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute z-20"
            style={{
              left: cursor.left,
              top: cursor.top,
              opacity: step >= 4 ? 0 : 1,
              transition: 'left 1.1s cubic-bezier(0.4,0,0.2,1), top 1.1s cubic-bezier(0.4,0,0.2,1), opacity 0.5s',
            }}
          >
            <path d="M5 3l14 7.5-6.2 1.6L9.6 18.5z" fill="#0E1512" stroke="#FFFFFF" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
      </ScaledStage>
    </div>
  );
}
