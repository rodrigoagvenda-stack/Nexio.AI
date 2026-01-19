"use client";

import React, { ReactElement, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface AnimatedListProps {
  className?: string;
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = React.memo(
  ({ className, children, delay = 100 }: AnimatedListProps) => {
    const [mounted, setMounted] = useState(false);
    const childrenArray = React.Children.toArray(children);

    useEffect(() => {
      // Apenas anima na montagem inicial
      setMounted(true);
    }, []);

    return (
      <div className={`flex flex-col gap-3 ${className}`}>
        <AnimatePresence mode="popLayout">
          {childrenArray.map((item, index) => (
            <AnimatedListItem
              key={(item as ReactElement).key}
              index={index}
              delay={delay}
              mounted={mounted}
            >
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  }
);

AnimatedList.displayName = "AnimatedList";

export const AnimatedListItem = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    index: number;
    delay: number;
    mounted: boolean;
  }
>(({ children, index, delay, mounted }, ref) => {
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={
        mounted
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 20, scale: 0.95 }
      }
      transition={{
        duration: 0.4,
        delay: index * (delay / 1000),
        ease: [0.4, 0, 0.2, 1],
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
});

AnimatedListItem.displayName = "AnimatedListItem";
