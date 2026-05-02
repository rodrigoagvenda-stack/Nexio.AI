'use client'

import { useEffect, useState } from 'react'
import { ZaapliLogo } from './ZaapliLogo'

interface ZaapliLoaderProps {
  /** duração mínima do splash em ms (default 1200) */
  minDuration?: number
  /** chamado quando o splash termina */
  onDone?: () => void
}

export function ZaapliLoader({ minDuration = 1200, onDone }: ZaapliLoaderProps) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true)
      setTimeout(() => {
        setVisible(false)
        onDone?.()
      }, 400)
    }, minDuration)
    return () => clearTimeout(timer)
  }, [minDuration, onDone])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-400"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <div className="flex flex-col items-center gap-4">
        <ZaapliLogo variant="full" iconSize={48} animate />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              style={{ animation: `zaapli-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
