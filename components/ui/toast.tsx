"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { Check, X, AlertCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils/cn"

// Avisos rápidos: aparecem no canto inferior direito, somem sozinhos e mostram uma barra
// com o tempo que falta. Passar o mouse por cima pausa o tempo (o Radix pausa e a barra acompanha).
const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed z-[100] flex max-h-screen flex-col gap-3 p-4 top-4 left-1/2 -translate-x-1/2 w-[calc(100vw-32px)] max-w-[440px] sm:top-auto sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:w-[440px] sm:max-w-none",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

/** default = sucesso, destructive = erro (nomes antigos, usados no sistema todo). */
export type ToastVariant = "default" | "success" | "destructive" | "warning" | "info" | "loading"
type Tone = "success" | "error" | "warning" | "info" | "loading"

const TONES: Record<Tone, { bg: string; fg: string; ms: number }> = {
  success: { bg: "#12301F", fg: "#96F63C", ms: 4000 },
  error: { bg: "#2B1414", fg: "#F87171", ms: 8000 },
  warning: { bg: "#2A2410", fg: "#E9C46A", ms: 6000 },
  info: { bg: "#0F1A24", fg: "#6AB0F3", ms: 5000 },
  loading: { bg: "#12301F", fg: "#96F63C", ms: Infinity },
}

function toneOf(variant?: ToastVariant): Tone {
  switch (variant) {
    case "destructive": return "error"
    case "warning": return "warning"
    case "info": return "info"
    case "loading": return "loading"
    default: return "success"
  }
}

/** Tempo na tela: sucesso 4s, erro 8s, atenção e "com ação" (ex.: desfazer) 6s, informação 5s, trabalhando sem fim. */
export function toastDuration(variant?: ToastVariant, hasAction = false): number {
  const tone = toneOf(variant)
  if (tone === "success" && hasAction) return 6000
  return TONES[tone].ms
}

type ToastProps = Omit<React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>, "variant"> & {
  variant?: ToastVariant
}

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitives.Root>, ToastProps>(
  ({ className, variant, duration, children, onPause, onResume, ...props }, ref) => {
    const tone = toneOf(variant)
    const t = TONES[tone]
    const ms = duration ?? toastDuration(variant)
    const timed = tone !== "loading" && Number.isFinite(ms)
    const [paused, setPaused] = React.useState(false)
    const Icon = tone === "error" ? X : tone === "warning" ? AlertCircle : tone === "info" ? Info : Check

    return (
      <ToastPrimitives.Root
        ref={ref}
        duration={ms}
        onPause={() => { setPaused(true); onPause?.() }}
        onResume={() => { setPaused(false); onResume?.() }}
        className={cn(
          "group pointer-events-auto relative flex w-full items-start gap-[14px] overflow-hidden rounded-2xl border border-[#262626] bg-[#141414] pt-[18px] px-5 pb-[22px] text-white shadow-[0_12px_32px_#00000080] transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
          className
        )}
        {...props}
      >
        {tone === "loading" ? (
          <div
            aria-hidden="true"
            className="h-9 w-9 shrink-0 animate-spin rounded-full border-[3px] border-[#1C1C1C]"
            style={{ borderTopColor: t.fg }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: t.bg }}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.6} style={{ color: t.fg }} />
          </div>
        )}
        {children}
        {timed && (
          <div aria-hidden="true" className="absolute bottom-0 left-0 h-1 w-full bg-[#1C1C1C]">
            <div
              // a chave reinicia a barra quando o aviso muda de tipo (ex.: "trabalhando" vira sucesso)
              key={`${tone}-${ms}`}
              className="h-1 w-full origin-left"
              style={{
                backgroundColor: t.fg,
                animation: `zt-shrink ${ms}ms linear forwards`,
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          </div>
        )}
      </ToastPrimitives.Root>
    )
  }
)
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "mt-0.5 shrink-0 rounded-md px-1 text-sm font-semibold leading-[18px] text-white transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#96F63C]/60",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-lg p-1 text-white/40 opacity-0 transition-opacity hover:text-white focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#96F63C]/50 group-hover:opacity-100",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-base font-semibold leading-[22px] text-white", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm leading-5 text-[#A3A3A3]", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
