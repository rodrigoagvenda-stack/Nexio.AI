'use client';

import { motion } from 'framer-motion';

interface OrbProps {
  className?: string;
  size?: number;
}

export function Orb({ className = '', size = 400 }: OrbProps) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/40 via-purple-500/40 to-pink-500/40 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 via-purple-600/30 to-transparent blur-2xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />
    </div>
  );
}
