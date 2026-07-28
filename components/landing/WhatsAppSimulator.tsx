'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ZaapliIcon } from '@/components/brand/ZaapliIcon';
import { CheckCheck, Send } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const LEAD_MESSAGE = 'Oi, vi o anúncio, quanto custa o serviço?';
const REPLY_MESSAGE = 'Oi! Consigo te ajudar agora. Pra te passar o valor certo: é pra uso pessoal ou pra empresa?';

export function WhatsAppSimulator() {
  const rootRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mql.matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const root = rootRef.current;
    const lead = leadRef.current;
    const typing = typingRef.current;
    const reply = replyRef.current;
    if (!root || !lead || !typing || !reply) return;

    gsap.set([lead, typing, reply], { autoAlpha: 0, y: 12 });

    const tl = gsap.timeline({ paused: true });
    tl.to(lead, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' })
      .to(typing, { autoAlpha: 1, y: 0, duration: 0.3, ease: 'power2.out' }, '+=0.5')
      .to(typing, { autoAlpha: 0, duration: 0.2 }, '+=1.1')
      .to(reply, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' });

    const st = ScrollTrigger.create({
      trigger: root,
      start: 'top 75%',
      once: true,
      onEnter: () => tl.play(),
    });

    return () => {
      st.kill();
      tl.kill();
    };
  }, [reducedMotion]);

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
        <div ref={leadRef} className="flex justify-start">
          <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-[#1F1F1F] px-3 py-2">
            <p className="text-[13.5px] text-[#EDEDED] leading-snug">{LEAD_MESSAGE}</p>
            <span className="block text-right text-[10px] text-[#888] mt-1">23:47</span>
          </div>
        </div>

        <div ref={typingRef} className="flex justify-end">
          <div className="rounded-2xl rounded-br-sm bg-[#01573C] px-3.5 py-2.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8d8d8]/70 animate-[zaapply-dot_1s_infinite]" style={{ animationDelay: '0s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8d8d8]/70 animate-[zaapply-dot_1s_infinite]" style={{ animationDelay: '0.15s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[#d8d8d8]/70 animate-[zaapply-dot_1s_infinite]" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>

        <div ref={replyRef} className="flex justify-end">
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
