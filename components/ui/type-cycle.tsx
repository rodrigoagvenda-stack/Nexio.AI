'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { gsap } from 'gsap';

interface TypeCycleProps {
  texts: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  initialDelay?: number;
  className?: string;
  cursorClassName?: string;
  showCursor?: boolean;
  cursorCharacter?: string;
  cursorBlinkDuration?: number;
  variableSpeed?: { min: number; max: number };
}

export function TypeCycle({
  texts,
  typingSpeed = 60,
  deletingSpeed = 35,
  pauseDuration = 2200,
  initialDelay = 400,
  className = '',
  cursorClassName = '',
  showCursor = true,
  cursorCharacter = '|',
  cursorBlinkDuration = 0.5,
  variableSpeed,
}: TypeCycleProps) {
  const [displayed, setDisplayed] = useState('');
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [textIdx, setTextIdx] = useState(0);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const textArray = useMemo(() => (texts.length ? texts : ['']), [texts]);

  const speed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    return Math.random() * (variableSpeed.max - variableSpeed.min) + variableSpeed.min;
  }, [variableSpeed, typingSpeed]);

  // Cursor blink via gsap
  useEffect(() => {
    if (!showCursor || !cursorRef.current) return;
    gsap.set(cursorRef.current, { opacity: 1 });
    const tween = gsap.to(cursorRef.current, {
      opacity: 0,
      duration: cursorBlinkDuration,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut',
    });
    return () => { tween.kill(); };
  }, [showCursor, cursorBlinkDuration]);

  // Typing machine
  useEffect(() => {
    const current = textArray[textIdx];

    let t: ReturnType<typeof setTimeout>;

    if (deleting) {
      if (displayed === '') {
        setDeleting(false);
        setTextIdx(prev => (prev + 1) % textArray.length);
        setCharIdx(0);
        return;
      }
      t = setTimeout(() => setDisplayed(p => p.slice(0, -1)), deletingSpeed);
    } else {
      if (charIdx < current.length) {
        t = setTimeout(() => {
          setDisplayed(p => p + current[charIdx]);
          setCharIdx(p => p + 1);
        }, charIdx === 0 && displayed === '' ? initialDelay : speed());
      } else {
        t = setTimeout(() => setDeleting(true), pauseDuration);
      }
    }

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charIdx, displayed, deleting, textIdx]);

  return (
    <span className={`inline ${className}`}>
      <span>{displayed}</span>
      {showCursor && (
        <span ref={cursorRef} className={`ml-0.5 inline-block ${cursorClassName}`}>
          {cursorCharacter}
        </span>
      )}
    </span>
  );
}
