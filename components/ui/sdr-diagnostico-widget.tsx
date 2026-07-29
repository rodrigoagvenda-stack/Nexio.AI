'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import {
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  X,
  Circle,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Check,
  Loader2,
  BookOpen,
  MessageSquare,
  User,
} from 'lucide-react'
import type { ValidationResult, ValidationGap } from '@/lib/sdr/validator'

interface Props {
  result: ValidationResult
  persona?: Record<string, string>
  onClose: () => void
  onNavigate?: (tab: 'identidade' | 'conhecimento' | 'integracoes' | 'geral') => void
}

const SPRING = {
  type: 'spring',
  stiffness: 300,
  damping: 28,
  mass: 1,
} as const

function scoreColor(score: number) {
  if (score >= 75) return '#01573C'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function statusLabel(score: number) {
  if (score >= 75) return 'SDR pronto para ativar'
  if (score >= 50) return 'Atenção — ajustes recomendados'
  return 'Ajustes necessários'
}

export function SdrDiagnosticoWidget({ result, persona, onClose, onNavigate }: Props) {
  const [isOpen, setIsOpen] = useState(true)

  const total = result.covered.length + result.gaps.length
  const color = scoreColor(result.score)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <LayoutGroup>
        <motion.div
          layout
          initial={false}
          transition={SPRING}
          className={`bg-white dark:bg-neutral-950 border-2 border-neutral-100 dark:border-neutral-800 shadow-2xl overflow-hidden select-none relative w-full max-w-md ${
            isOpen ? 'rounded-[24px] p-5' : 'rounded-[20px] p-3'
          }`}
        >
          {/* ── Header ── */}
          <div className="flex items-center justify-between relative z-10 gap-2">
            <motion.div
              layout="position"
              transition={SPRING}
              onClick={() => setIsOpen(!isOpen)}
              className={`flex items-center gap-2 cursor-pointer flex-1 min-w-0 ${
                isOpen ? 'bg-transparent' : 'bg-neutral-50 dark:bg-neutral-900'
              } pr-2 pl-1.5 py-0.5 rounded-lg transition-colors`}
            >
              <motion.div
                layout
                transition={SPRING}
                className={`flex items-center justify-center border-[1.7px] my-0.5 rounded-lg bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 shrink-0 transition-colors ${
                  isOpen ? 'w-10 h-10' : 'w-7 h-7'
                }`}
              >
                {result.score >= 75 ? (
                  <ShieldCheck size={isOpen ? 20 : 14} style={{ color: '#01573C' }} />
                ) : (
                  <ShieldAlert size={isOpen ? 20 : 14} style={{ color: color }} />
                )}
              </motion.div>

              <motion.h2
                layout
                transition={SPRING}
                className={`font-semibold font-sans origin-left text-neutral-800 dark:text-neutral-100 transition-colors ${
                  isOpen ? 'text-xl' : 'text-sm whitespace-nowrap'
                }`}
              >
                Diagnóstico do SDR
              </motion.h2>
            </motion.div>

            <AnimatePresence mode="popLayout" initial={false}>
              {!isOpen ? (
                <motion.div
                  key="collapsed-progress"
                  initial={{ opacity: 0, scale: 0.9, x: 10 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsOpen(true)}
                >
                  <div className="w-20 h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${result.score}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums" style={{ color }}>{result.score}</span>
                </motion.div>
              ) : (
                <motion.button
                  key="close-btn"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={onClose}
                  className="bg-white dark:bg-neutral-950 border-2 border-neutral-100 dark:border-neutral-800 p-1.5 rounded-md text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100 transition-colors"
                >
                  <X size={18} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* ── Collapsed sub-header ── */}
          <AnimatePresence mode="popLayout">
            {!isOpen && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-between mt-3 px-1 cursor-pointer"
                onClick={() => setIsOpen(true)}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  <span>{result.covered.length} de {total} cenários cobertos</span>
                  {result.gaps.length > 0 && (
                    <span className="text-neutral-400">· {result.gaps.length} lacuna{result.gaps.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-400">
                  <span>ver detalhes</span>
                  <ChevronDown size={12} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Expanded content ── */}
          <AnimatePresence mode="popLayout">
            {isOpen && (
              <motion.div
                layout
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
                transition={{ ...SPRING, delay: 0.05 }}
                className="mt-5 origin-top"
              >
                {/* Score pill */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 border-[1.5px] rounded-full mb-5 w-fit bg-neutral-50/50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700">
                  {result.score >= 75
                    ? <CheckCircle2 size={20} style={{ color: '#01573C' }} />
                    : <Circle size={20} className="text-neutral-300 dark:text-neutral-600" />
                  }
                  <span className="text-sm font-semibold text-neutral-400 dark:text-neutral-500">
                    {result.covered.length} de {total}
                  </span>
                  <div className="w-24 h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full mx-1">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${result.score}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color }}>
                    {result.score}/100
                  </span>
                </div>

                {/* Gaps */}
                {result.gaps.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-8">
                    <CheckCircle2 size={36} style={{ color: '#01573C' }} />
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Todos os cenários cobertos</p>
                  </motion.div>
                ) : (
                  <div className="relative ml-4 mb-4 flex flex-col gap-3 max-h-[52vh] overflow-y-auto pr-1">
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      className="absolute left-0 top-0 bottom-4 w-[1.7px] origin-top bg-neutral-200 dark:bg-neutral-700"
                    />
                    {result.gaps.map((gap, idx) => (
                      <GapItem
                        key={gap.id}
                        gap={gap}
                        idx={idx}
                        persona={persona}
                        onNavigate={onNavigate}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                )}

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800"
                >
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">{statusLabel(result.score)}</span>
                  <button
                    onClick={onClose}
                    className="text-xs font-semibold px-4 py-1.5 rounded-lg border-[1.5px] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                  >
                    Fechar
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
    </div>
  )
}

// ── Gap item ─────────────────────────────────────────────────────────────────

interface GapItemProps {
  gap: ValidationGap
  idx: number
  persona?: Record<string, string>
  onNavigate?: (tab: 'identidade' | 'conhecimento' | 'integracoes' | 'geral') => void
  onClose?: () => void
}

function GapItem({ gap, idx, persona, onNavigate, onClose }: GapItemProps) {
  const [open, setOpen] = useState(false)
  const [loadingFix, setLoadingFix] = useState(false)
  const [fixText, setFixText] = useState<string | null>(null)
  const [fixApplied, setFixApplied] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)

  const handleGenerateFix = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoadingFix(true)
    setFixError(null)
    setFixApplied(false)
    try {
      const res = await fetch('/api/sdr/fix-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap, persona }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFixText(data.fix_text)
      setFixApplied(true)
    } catch (err: any) {
      setFixError(err?.message ?? 'Erro ao gerar correção. Tente novamente.')
    } finally {
      setLoadingFix(false)
    }
  }

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onNavigate?.(gap.tab_wizard)
    onClose?.()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.08 + idx * 0.04 }}
      className="relative pl-7"
    >
      <div className="absolute left-0 top-[-8px] w-4 h-[26px] border-l-[1.7px] border-b-[1.7px] rounded-bl-xl border-neutral-200 dark:border-neutral-700" />

      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {/* Title row */}
        <div className="flex items-center gap-2">
          <SeverityDot severity={gap.severity} />
          <SeverityBadge severity={gap.severity} />
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200 leading-tight flex-1">
            {gap.scenario}
          </p>
          <ChevronDown size={14} className={`text-neutral-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        </div>

        {/* Source badge */}
        <div className="mt-1.5 ml-0.5">
          <SourceBadge source={gap.source as ValidationGap['source']} />
        </div>

        {/* Expanded detail */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-2 space-y-2 pl-0.5"
              onClick={e => e.stopPropagation()}
            >
              {/* what_fails */}
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {gap.what_fails}
              </p>

              {/* Example conversation */}
              {gap.example && (
                <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1 mb-1.5">
                    <MessageSquare size={10} className="text-neutral-400" />
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Exemplo de falha</span>
                  </div>
                  <div className="space-y-1">
                    {gap.example.split('\n').map((line, i) => (
                      <p key={i} className="text-xs text-neutral-600 dark:text-neutral-300 font-mono leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* suggestion */}
              <div className="flex items-start gap-1.5">
                <AlertCircle size={11} className="shrink-0 mt-0.5" style={{ color: '#01573C' }} />
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {gap.suggestion}
                </p>
              </div>

              {/* Fix preview */}
              {fixText && (
                <div className={`rounded-lg px-3 py-2.5 mt-1 ${fixApplied ? 'bg-[#01573C]/10 border border-[#01573C]/30' : 'bg-neutral-900 dark:bg-neutral-800'}`}>
                  {fixApplied && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Check size={12} style={{ color: '#01573C' }} />
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#01573C' }}>
                        Adicionado à {gap.source}
                      </span>
                    </div>
                  )}
                  <p className={`text-xs leading-relaxed whitespace-pre-wrap font-mono ${fixApplied ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-200'}`}>
                    {fixText}
                  </p>
                </div>
              )}

              {fixError && (
                <p className="text-xs text-red-500 mt-1">{fixError}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                {!fixApplied && (
                  <button
                    onClick={handleGenerateFix}
                    disabled={loadingFix}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    {loadingFix ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                    {loadingFix ? 'Aplicando...' : 'Gerar e aplicar correção'}
                  </button>
                )}

                {fixApplied && (
                  <button
                    onClick={handleGenerateFix}
                    disabled={loadingFix}
                    className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
                  >
                    <Wand2 size={11} />
                    Gerar novamente
                  </button>
                )}

                {onNavigate && (
                  <button
                    onClick={handleNavigate}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border-[1.5px] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                  >
                    <BookOpen size={12} />
                    Ver em {gap.source === 'Identidade do Agente' ? 'Identidade' : gap.source === 'Base de Objeções' ? 'Objeções' : 'Conhecimento'}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Atoms ─────────────────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: 'critica' | 'alta' | 'media' }) {
  const color = severity === 'critica' ? 'bg-red-500' : severity === 'alta' ? 'bg-amber-500' : 'bg-neutral-400'
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
}

function SeverityBadge({ severity }: { severity: 'critica' | 'alta' | 'media' }) {
  const styles = {
    critica: 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400',
    alta: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    media: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400',
  }
  const labels = { critica: 'CRÍTICO', alta: 'ALTO', media: 'MÉDIO' }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${styles[severity]}`}>
      {labels[severity]}
    </span>
  )
}

function SourceBadge({ source }: { source: ValidationGap['source'] }) {
  const icon = source === 'Base de Objeções'
    ? <MessageSquare size={9} />
    : source === 'Identidade do Agente'
    ? <User size={9} />
    : <BookOpen size={9} />

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 dark:text-neutral-500">
      {icon}
      {source}
    </span>
  )
}
