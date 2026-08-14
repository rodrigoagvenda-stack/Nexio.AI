'use client';

import { useEffect, useRef, useState } from 'react';
import { ZaapliIcon } from '@/components/brand/ZaapliIcon';
import { CheckCheck, Send } from 'lucide-react';

const LEAD_MESSAGE = 'Oi, vi o anúncio, quanto custa o serviço?';
const REPLY_MESSAGE = 'Oi! Consigo te ajudar agora. Pra te passar o valor certo: é pra uso pessoal ou pra empresa?';

type Step = 'idle' | 'lead' | 'typing' | 'reply';

function stepStyle(active: boolean) {
  return {
    opacity: active ? 1 : 0,
    transform: active ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
  };
}

export function WhatsAppSimulator() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>('idle');

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep('reply');
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        setStep('lead');
        timers.push(setTimeout(() => setStep('typing'), 500));
        timers.push(setTimeout(() => setStep('reply'), 1900));
      },
      { threshold: 0.3 }
    );

    observer.observe(root);
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  const showLead = step === 'lead' || step === 'typing' || step === 'reply';
  const showTyping = step === 'typing';
  const showReply = step === 'reply';

  return (
    <div
      ref={rootRef}
      className="w-full max-w-[360px] rounded-[28px] border border-[#212121] bg-[#0C0C0C] shadow-2xl overflow-hidden"
    >
      {/* topo do chat */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#141414] border-b border-[#212121]">
        <div className="w-9 h-9 rounded-full bg-[#0F3D2B] flex items-center justify-center flex-shrink-0">
          <ZaapliIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">Zaapply</p>
          <p className="text-[11px] text-[#96F63C] flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#96F63C] opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#96F63C]" />
            </span>
            online
          </p>
        </div>
      </div>

      {/* área de mensagens */}
      <div className="chat-background dark min-h-[260px] px-3.5 py-4 flex flex-col justify-end gap-2">
        <div className="flex justify-start" style={stepStyle(showLead)}>
          <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-[#1F1F1F] px-3 py-2">
            <p className="text-[13.5px] text-[#EDEDED] leading-snug">{LEAD_MESSAGE}</p>
            <span className="block text-right text-[10px] text-[#888] mt-1">23:47</span>
          </div>
        </div>

        <div className="flex justify-end" style={stepStyle(showTyping)}>
          <div className="rounded-2xl rounded-br-sm bg-[#01573C] px-3.5 py-2.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8d8d8]/70 animate-[zaapply-dot_1s_infinite]" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8d8d8]/70 animate-[zaapply-dot_1s_infinite]" style={{ animationDelay: '0.15s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8d8d8]/70 animate-[zaapply-dot_1s_infinite]" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>

        <div className="flex justify-end" style={stepStyle(showReply)}>
          <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-[#01573C] px-3 py-2">
            <p className="text-[13.5px] text-[#EDEDED] leading-snug">{REPLY_MESSAGE}</p>
            <span className="flex items-center justify-end gap-1 text-[10px] text-[#a8d9c8] mt-1">
              23:47 <CheckCheck className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* barra de input, sempre pronta */}
      <div className="flex items-center gap-2 px-3.5 py-3 bg-[#141414] border-t border-[#212121]">
        <div className="flex-1 h-9 rounded-full bg-[#1F1F1F] px-3.5 flex items-center">
          <span className="text-[13px] text-[#666]">Digite uma mensagem</span>
          <span className="ml-0.5 inline-block w-px h-4 bg-[#888] animate-pulse" />
        </div>
        <div className="w-9 h-9 rounded-full bg-[#01573C] flex items-center justify-center flex-shrink-0">
          <Send className="w-4 h-4 text-[#d8d8d8]" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
