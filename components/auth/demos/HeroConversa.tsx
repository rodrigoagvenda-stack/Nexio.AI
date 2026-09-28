'use client';

import { Bot, Calendar } from 'lucide-react';
import { useTimeline } from './useTimeline';

/** Instantes (ms): lead escreve, SDR digita e responde, lead responde, SDR digita e responde, reunião marcada. */
const TIMES = [0, 700, 1900, 3500, 5200, 6300, 7900, 9600, 10700, 12300] as const;

const SHADOW = 'shadow-[0_8px_24px_rgba(14,21,18,0.07)]';

function Lead({ text, time }: { text: string; time: string }) {
  return (
    <div className="demo-pop flex justify-start">
      <div className={`flex max-w-[86%] items-end gap-3 rounded-[18px] rounded-bl-[4px] border border-[#E2E7E4] bg-white px-4 py-3 ${SHADOW}`}>
        <span className="text-[14.5px] leading-[21px] text-[#0E1512]">{text}</span>
        <span className="text-[11px] leading-[14px] text-[#8A948E]">{time}</span>
      </div>
    </div>
  );
}

function Sdr({ text, time }: { text: string; time: string }) {
  return (
    <div className="demo-pop flex justify-end">
      <div className={`flex max-w-[86%] flex-col gap-1 rounded-[18px] rounded-br-[4px] border border-[#BFD9CB] bg-[#E6F1EB] px-4 py-3 ${SHADOW}`}>
        <div className="flex items-center gap-1.5">
          <Bot size={12} strokeWidth={2} className="text-[#01573C]" />
          <span className="text-[11.5px] font-semibold text-[#01573C]">SDR</span>
        </div>
        <span className="text-[14.5px] leading-[21px] text-[#0E1512]">{text}</span>
        <span className="self-end text-[11px] leading-[14px] text-[#5B6660]">{time}</span>
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="demo-pop flex justify-end">
      <div className={`flex items-center gap-1.5 rounded-[18px] rounded-br-[4px] border border-[#BFD9CB] bg-[#E6F1EB] px-4 py-3.5 ${SHADOW}`}>
        {[0, 0.15, 0.3].map((d) => (
          <span key={d} className="h-2 w-2 animate-[zaapply-dot_1s_infinite] rounded-full bg-[#01573C]/60" style={{ animationDelay: `${d}s` }} />
        ))}
      </div>
    </div>
  );
}

/** Conversa animada, solta na página (sem moldura nem fundo). Dados fictícios; repete enquanto está na tela. */
export function HeroConversa() {
  const { ref, step } = useTimeline(TIMES, 4500);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Exemplo de conversa: o lead escreve às 23h07, o SDR responde e a reunião é marcada"
      className="flex h-[470px] w-[380px] flex-col justify-end gap-3 overflow-hidden pb-1 [mask-image:linear-gradient(to_bottom,transparent,#000_16%)]"
    >
      {step >= 1 && <Lead text="Oi, vi o anúncio de vocês. Como funciona?" time="23:07" />}
      {step === 2 && <Typing />}
      {step >= 3 && <Sdr text="Oi, Marina! Vou te explicar rapidinho. Você já atende seus clientes pelo WhatsApp hoje?" time="23:08" />}
      {step >= 4 && <Lead text="Sim, mas perco muita mensagem à noite" time="23:08" />}
      {step === 5 && <Typing />}
      {step >= 6 && <Sdr text="Faz sentido. Quer 15 minutos amanhã para eu te mostrar?" time="23:09" />}
      {step >= 7 && <Lead text="Pode ser às 10h" time="23:09" />}
      {step === 8 && <Typing />}
      {step >= 9 && (
        <div className="demo-pop flex flex-col items-end gap-2">
          <div className={`flex max-w-[86%] flex-col gap-1 rounded-[18px] rounded-br-[4px] border border-[#BFD9CB] bg-[#E6F1EB] px-4 py-3 ${SHADOW}`}>
            <div className="flex items-center gap-1.5">
              <Bot size={12} strokeWidth={2} className="text-[#01573C]" />
              <span className="text-[11.5px] font-semibold text-[#01573C]">SDR</span>
            </div>
            <span className="text-[14.5px] leading-[21px] text-[#0E1512]">Combinado! Reunião marcada para amanhã às 10h.</span>
            <span className="self-end text-[11px] leading-[14px] text-[#5B6660]">23:10</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-[#01573C] px-3.5 py-1.5 text-xs font-semibold text-white [box-shadow:0_2px_0_#013825]">
            <Calendar size={13} strokeWidth={2.2} /> Reunião marcada
          </div>
        </div>
      )}
    </div>
  );
}
