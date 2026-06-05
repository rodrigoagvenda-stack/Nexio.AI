# Interactive Product Demo — Padrão de Implementação

> Exemplo de referência: `components/demo/ProductDemo.tsx`  
> Rota de preview: `/demo`

---

## Conceito

Demo interativa estilo Sentry: o usuário **clica** onde o sistema indica e a UI avança.  
Sem cursor animado automático. O hotspot (anel pulsante) + tooltip escuro guia o clique.

---

## Arquitetura em 3 camadas

```
1. PortalTooltip   — tooltip via createPortal → document.body (nunca clipado)
2. Hotspot         — wrapper que adiciona o anel pulsante + PortalTooltip
3. Scene machine   — estado que determina qual hotspot/tela mostrar
```

---

## 1. PortalTooltip (copiar exatamente)

**Por que portal?** Qualquer `overflow: hidden` ou `overflow: auto` em ancestor clipa tooltips `position: absolute`. Com `position: fixed` + portal no `document.body`, nada clipa.

**Dois bugs críticos a evitar:**

| Bug | Causa | Fix |
|-----|-------|-----|
| Crash "Application error" | `createPortal(content, document.body)` no SSR — `document` não existe no servidor | `mounted` state: só renderiza após `useEffect` confirmar cliente |
| Loop infinito + crash | `useLayoutEffect` sem deps → `setStyle` → re-render → effect → loop | Adicionar deps `[label, side]` |

```tsx
'use client'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

function PortalTooltip({
  anchorRef, label, side, minW = 240,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  label: string
  side: TooltipSide
  minW?: number
}) {
  const [mounted, setMounted] = useState(false)
  const [style, setStyle]     = useState<React.CSSProperties | null>(null)

  // OBRIGATÓRIO: document.body só existe no cliente
  useEffect(() => { setMounted(true) }, [])

  // OBRIGATÓRIO: deps [label, side] previne loop infinito
  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r   = el.getBoundingClientRect()
    const gap = 12
    let s: React.CSSProperties
    if (side === 'top')         s = { bottom: window.innerHeight - r.top + gap, left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'bottom') s = { top: r.bottom + gap,                      left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'right')  s = { top: r.top + r.height / 2,               left: r.right + gap,         transform: 'translateY(-50%)' }
    else                        s = { top: r.top + r.height / 2,               right: window.innerWidth - r.left + gap, transform: 'translateY(-50%)' }
    setStyle(s)
  }, [label, side]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !style) return null

  return createPortal(
    <div className="fixed z-[9999] pointer-events-none" style={{ ...style, minWidth: minW }}>
      <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
        {label}
      </div>
      {/* Seta direcional */}
      {side === 'top'    && <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#1c1c1e]" />}
      {side === 'bottom' && <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#1c1c1e]" />}
      {side === 'right'  && <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-r-[8px] border-t-transparent border-b-transparent border-r-[#1c1c1e]" />}
      {side === 'left'   && <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-l-[8px] border-t-transparent border-b-transparent border-l-[#1c1c1e]" />}
    </div>,
    document.body
  )
}
```

---

## 2. Hotspot (wrapper para elementos clicáveis)

Usa internamente um `ref` + `PortalTooltip`. Envolve qualquer elemento.

```tsx
function Hotspot({ children, label, onClick, side = 'top', minW = 240 }: {
  children: React.ReactNode
  label: string
  onClick: () => void
  side?: TooltipSide
  minW?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="relative inline-block cursor-pointer" onClick={onClick}>
      {/* Anel pulsante verde */}
      <div className="absolute -inset-1.5 rounded-lg ring-2 ring-primary shadow-[0_0_12px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
      <PortalTooltip anchorRef={ref} label={label} side={side} minW={minW} />
      {children}
    </div>
  )
}
```

**Uso:**
```tsx
<Hotspot label="Clique aqui para avançar" onClick={handleNext} side="right" minW={280}>
  <button className="...">Texto do botão</button>
</Hotspot>
```

---

## 3. Hotspot em elementos que NÃO usam o wrapper (ex: nav, tabs)

Quando o elemento hotspot já existe na UI (nav sidebar, tab button), não dá para envolver com `Hotspot`. Use `ref` + `PortalTooltip` separados:

```tsx
function MinhaComponente({ hotspot }: { hotspot: string | null }) {
  const hotspotRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      {items.map(item => {
        const isHotspot = hotspot === item.id
        return (
          <div key={item.id} className="relative">
            {/* Anel pulsante */}
            {isHotspot && (
              <div className="absolute inset-0 rounded-lg ring-2 ring-primary animate-pulse pointer-events-none z-10" />
            )}
            <button
              ref={isHotspot ? hotspotRef : null}  {/* ref só no item ativo */}
              onClick={() => isHotspot && onHotspot(item.id)}
              className={cn('...', isHotspot && 'cursor-pointer')}
            >
              {item.label}
            </button>
          </div>
        )
      })}

      {/* Tooltip fora do loop — ref aponta para o item ativo */}
      {hotspot && (
        <PortalTooltip
          anchorRef={hotspotRef}
          label="Instrução para o usuário"
          side="right"
          minW={260}
        />
      )}
    </div>
  )
}
```

---

## 4. Scene machine

Define todas as cenas, metadados e transições num objeto central.

```tsx
type Scene = 'step_a' | 'step_b' | 'step_c' | 'done'

const SCENES: Scene[] = ['step_a', 'step_b', 'step_c', 'done']

const SCENE_META: Record<Scene, { nav: string; url: string; label: string }> = {
  step_a: { nav: 'secao_x', url: 'pagina/x', label: 'Instrução da etapa A' },
  step_b: { nav: 'secao_y', url: 'pagina/y', label: 'Instrução da etapa B' },
  step_c: { nav: 'secao_y', url: 'pagina/y', label: 'Instrução da etapa C' },
  done:   { nav: 'secao_y', url: 'pagina/y', label: 'Concluído!' },
}

// No componente raiz:
const [scene, setScene] = useState<Scene>('step_a')
const advance = () => setScene(s => SCENES[Math.min(SCENES.indexOf(s) + 1, SCENES.length - 1)])
```

---

## 5. Shell do demo (estrutura do container)

```tsx
<div className="rounded-2xl border border-border shadow-xl bg-background" style={{ minWidth: 1080 }}>
  {/* Barra de URL falsa */}
  <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-3 rounded-t-2xl">
    <div className="flex gap-1.5">
      <div className="w-3 h-3 rounded-full bg-red-400/60" />
      <div className="w-3 h-3 rounded-full bg-amber-400/60" />
      <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
    </div>
    <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
      app.meusite.com/{meta.url}
    </div>
  </div>

  {/* App shell — sidebar + conteúdo */}
  <div className="flex" style={{ height: 620 }}>
    <FakeSidebar active={meta.nav} ... />
    <div className="flex-1 min-w-0 relative overflow-hidden">
      <div key={scene} className="absolute inset-0 animate-in fade-in duration-200">
        {/* Tela atual */}
      </div>
    </div>
  </div>

  {/* Barra de progresso */}
  <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-4 rounded-b-2xl">
    <div className="flex gap-1.5">
      {SCENES.filter(s => s !== 'done').map((s, i) => (
        <div key={s} className={cn(
          'rounded-full transition-all duration-300',
          s === scene       ? 'w-5 h-1.5 bg-primary'
            : i < sceneIdx ? 'w-1.5 h-1.5 bg-primary/50'
                           : 'w-1.5 h-1.5 bg-muted-foreground/20'
        )} />
      ))}
    </div>
    <p className="text-[12px] text-muted-foreground flex-1">{meta.label}</p>
  </div>
</div>
```

---

## Checklist para um novo demo

- [ ] Definir `Scene` type + `SCENES` array + `SCENE_META`
- [ ] Criar telas como componentes separados (`ScreenX`, `ScreenY`)
- [ ] Em cada tela, identificar qual elemento o usuário deve clicar
- [ ] Usar `Hotspot` para elementos isolados (botão, card, link)
- [ ] Usar `ref` + `PortalTooltip` separado para elementos em listas (nav items, tabs)
- [ ] Escolher `side` do tooltip que não colide com o conteúdo adjacente
- [ ] Testar que clicar fora do hotspot não avança a cena

---

## Regras de ouro

1. **Nunca** usar `position: absolute` para tooltip — sempre `PortalTooltip`
2. **Nunca** omitir deps no `useLayoutEffect` do PortalTooltip — causa loop infinito
3. **Sempre** ter o `mounted` guard antes de `createPortal` — crash em SSR (Next.js)
4. `minWidth` do tooltip: mínimo 240px, textos longos usar 280-320px
5. Preferir `side="right"` para elementos na borda esquerda; `side="top"` para elementos centrais
6. A tela dentro do shell usa `overflow-hidden` para clipar o conteúdo — os tooltips escapam pelo portal

---

## Regra de UX: sempre dizer o que clicar (usuário leigo)

**Todo hotspot precisa ter um label que diz exatamente o que fazer**, não apenas o que é o elemento.

| ❌ Errado | ✅ Certo |
|-----------|---------|
| `"QR Code"` | `"Clique no QR Code para simular o escaneamento com o celular"` |
| `"Gerar QR"` | `"Clique em Gerar novo QR Code para iniciar a conexão"` |
| `"Ativar agente"` | `"Tudo configurado! Clique aqui para ativar o Agente SDR"` |

**Momentos críticos que SEMPRE precisam de tooltip** (usuário não sabe o que fazer sem instrução):

- **Botão que dispara ação assíncrona** (ex: gerar QR) — tooltip antes do clique explicando o que vai acontecer
- **Resultado da ação** (ex: QR exibido) — tooltip instruindo o próximo passo ("agora clique no QR para escanear")
- **Transição de tela** — tooltip no item do menu/tab que o usuário precisa clicar para avançar

Sem tooltip nestes momentos, o usuário leigo para e não sabe o que fazer.
