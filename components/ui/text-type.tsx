'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface TextTypeProps {
  text: string;
  className?: string;
  delay?: number;
  speed?: number;
}

export function TextType({ text, className = '', delay = 0, speed = 50 }: TextTypeProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (currentIndex < text.length) {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }
    }, delay + currentIndex * speed);

    return () => clearTimeout(timeout);
  }, [currentIndex, text, delay, speed]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {displayedText}
      {currentIndex < text.length && (
        <motion.span
          className="inline-block w-0.5 h-[1em] bg-primary ml-1 align-middle"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </motion.span>
  );
}
