'use client'

import { ZaapliIcon } from './ZaapliIcon'

interface ZaapliLogoProps {
  /** 'full' = ícone + texto | 'icon' = só o ícone */
  variant?: 'full' | 'icon'
  /** 'auto' respeita dark mode CSS | 'light' força texto escuro | 'dark' força texto branco */
  theme?: 'auto' | 'light' | 'dark'
  iconSize?: number
  className?: string
  animate?: boolean
}

export function ZaapliLogo({
  variant = 'full',
  theme = 'auto',
  iconSize = 32,
  className = '',
  animate = false,
}: ZaapliLogoProps) {
  const textColor =
    theme === 'light' ? 'text-[#0d0d0d]' :
    theme === 'dark'  ? 'text-white' :
    'text-[#0d0d0d] dark:text-white'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ZaapliIcon size={iconSize} animate={animate} />
      {variant === 'full' && (
        <span
          className={`font-extrabold tracking-tight leading-none select-none ${textColor}`}
          style={{ fontSize: iconSize * 0.72, fontFamily: "'Nunito', 'Poppins', sans-serif", letterSpacing: '-0.01em' }}
        >
          zaapply
        </span>
      )}
    </div>
  )
}
