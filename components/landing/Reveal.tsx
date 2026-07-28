'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function Reveal({
  children,
  className = '',
  delay = 0,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { autoAlpha: 1, y: 0 });
      return;
    }

    gsap.set(el, { autoAlpha: 0, y });

    const tween = gsap.to(el, {
      autoAlpha: 1,
      y: 0,
      duration: 0.7,
      delay,
      ease: 'power3.out',
      paused: true,
    });

    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => tween.play(),
    });

    return () => {
      st.kill();
      tween.kill();
    };
  }, [delay, y]);

  return (
    <div ref={ref} className={className} style={{ visibility: 'hidden' }}>
      {children}
    </div>
  );
}
