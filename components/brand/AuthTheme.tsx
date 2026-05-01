'use client'

import { useEffect } from 'react'

/** Remove a classe `dark` do <html> enquanto nas páginas de auth (sempre light). Restaura ao sair. */
export function AuthTheme() {
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('dark')
    return () => { html.classList.add('dark') }
  }, [])
  return null
}
