/**
 * Ícones dos selos de cada e-mail. Só os paths (sem <svg> em volta) -- o
 * script de build (build-icons.ts) monta o círculo de fundo + ícone e
 * rasteriza em PNG, porque Gmail remove <svg> inline do corpo do e-mail
 * (foi exatamente isso que sumiu no teste real: o selo ficou vazio).
 */

const S = 'stroke="#01573C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"'

export const ICON_PATHS = {
  mail: `<rect x="3" y="5" width="18" height="14" rx="2" ${S}/><path d="m3 7 9 6 9-6" ${S}/>`,
  mailCheck: `<rect x="3" y="5" width="18" height="14" rx="2" ${S}/><path d="m3 7 9 6 9-6" ${S}/><path d="m16 15 2 2 3-4" ${S}/>`,
  userPlus: `<circle cx="9" cy="8" r="3.5" ${S}/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" ${S}/><path d="M18 8v5M20.5 10.5h-5" ${S}/>`,
  bolt: `<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z" ${S}/>`,
  lock: `<rect x="5" y="11" width="14" height="9" rx="2" ${S}/><path d="M8 11V7a4 4 0 1 1 8 0v4" ${S}/>`,
  lockCheck: `<rect x="5" y="11" width="14" height="9" rx="2" ${S}/><path d="M8 11V7a4 4 0 1 1 8 0v4" ${S}/><path d="m9.5 15 1.8 1.8L14.5 13" ${S}/>`,
  shieldCheck: `<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" ${S}/><path d="m8.5 12 2.3 2.3L15.5 9.5" ${S}/>`,
  shieldPlus: `<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" ${S}/><path d="M12 9v6M9 12h6" ${S}/>`,
  shieldMinus: `<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" ${S}/><path d="M9 12h6" ${S}/>`,
  phone: `<rect x="7" y="2" width="10" height="20" rx="2" ${S}/><path d="M11 18h2" ${S}/>`,
  link: `<path d="M9 15 15 9" ${S}/><path d="M10 7 13 4a4 4 0 1 1 6 6l-3 3" ${S}/><path d="M14 17l-3 3a4 4 0 1 1-6-6l3-3" ${S}/>`,
  unlink: `<path d="M10 7 13 4a4 4 0 1 1 6 6l-2 2" ${S}/><path d="M14 17l-3 3a4 4 0 1 1-6-6l2-2" ${S}/><path d="m4 4 16 16" ${S}/>`,
} as const

export type IconKey = keyof typeof ICON_PATHS
