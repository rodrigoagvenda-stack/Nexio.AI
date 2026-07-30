'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import {
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  const [currentIdx, setCurrentIdx] = useState(0)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set())

  const activeGaps = result.gaps.filter((g) => !resolvedIds.has(g.id))
  const safeIdx = Math.min(currentIdx, Math.max(0, activeGaps.length - 1))
  const currentGap = activeGaps[safeIdx]

  const resolvedCount = resolvedIds.size
  const totalScenarios = result.covered.length + result.gaps.length
  const adjustedScore = Math.min(100, result.score + Math.round(resolvedCount * (100 / Math.max(1, totalScenarios))))
  const color = scoreColor(adjustedScore)

  const handleResolved = (gapId: string) => {
    const newResolved = new Set(resolvedIds)
    newResolved.add(gapId)
    setResolvedIds(newResolved)
    const newActive = result.gaps.filter((g) => !newResolved.has(g.id))
    if (currentIdx >= newActive.length) {
      setCurrentIdx(Math.max(0, newActive.length - 1))
    }
  }

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
                {adjustedScore >= 75 ? (
                  <ShieldCheck size={isOpen ? 20 : 14} style={{ color: '#01573C' }} />
                ) : (
                  <ShieldAlert size={isOpen ? 20 : 14} style={{ color }} />
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
                    <div className="h-full rounded-full" style={{ width: `${adjustedScore}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums" style={{ color }}>{adjustedScore}</span>
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
                  <span>{result.covered.length + resolvedCount} de {totalScenarios} cenários cobertos</span>
                  {activeGaps.length > 0 && (
                    <span className="text-neutral-400">· {activeGaps.length} lacuna{activeGaps.length !== 1 ? 's' : ''}</span>
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
                  {adjustedScore >= 75
                    ? <CheckCircle2 size={20} style={{ color: '#01573C' }} />
                    : <Circle size={20} className="text-neutral-300 dark:text-neutral-600" />
                  }
                  <span className="text-sm font-semibold text-neutral-400 dark:text-neutral-500">
                    {result.covered.length + resolvedCount} de {totalScenarios}
                  </span>
                  <div className="w-24 h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full mx-1">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${adjustedScore}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color }}>
                    {adjustedScore}/100
                  </span>
                </div>

                {/* Gaps carousel */}
                {activeGaps.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 py-8">
                    <CheckCircle2 size={36} style={{ color: '#01573C' }} />
                    <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Todos os cenários cobertos</p>
                    <p className="text-xs text-neutral-400">Execute um novo diagnóstico para confirmar o score final.</p>
                  </motion.div>
                ) : (
                  <div>
                    {/* Nav bar */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        Lacuna <span className="font-semibold text-neutral-600 dark:text-neutral-300">{safeIdx + 1}</span> de {activeGaps.length}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                          disabled={safeIdx === 0}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft size={15} />
                        </button>
                        <button
                          onClick={() => setCurrentIdx((i) => Math.min(activeGaps.length - 1, i + 1))}
                          disabled={safeIdx === activeGaps.length - 1}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Gap card com animação de troca */}
                    <div className="max-h-[50vh] overflow-y-auto pr-0.5">
                      <AnimatePresence mode="wait" initial={false}>
                        {currentGap && (
                          <motion.div
                            key={currentGap.id}
                            initial={{ opacity: 0, x: 24 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -24 }}
                            transition={{ duration: 0.18 }}
                          >
                            <GapCard
                              gap={currentGap}
                              persona={persona}
                              onNavigate={onNavigate}
                              onClose={onClose}
                              onResolved={() => handleResolved(currentGap.id)}
                              onNext={
                                safeIdx < activeGaps.length - 1
                                  ? () => setCurrentIdx((i) => i + 1)
                                  : undefined
                              }
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800"
                >
                  <span className="text-xs text-neutral-400 dark:text-neutral-500">{statusLabel(adjustedScore)}</span>
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

// ── Gap card (sempre expandido, um por vez) ───────────────────────────────────

interface GapCardProps {
  gap: ValidationGap
  persona?: Record<string, string>
  onNavigate?: (tab: 'identidade' | 'conhecimento' | 'integracoes' | 'geral') => void
  onClose?: () => void
  onResolved?: () => void
  onNext?: () => void
}

function GapCard({ gap, persona, onNavigate, onClose, onResolved, onNext }: GapCardProps) {
  const [loadingFix, setLoadingFix] = useState(false)
  const [loadingApply, setLoadingApply] = useState(false)
  const [loadingRecheck, setLoadingRecheck] = useState(false)
  const [fixText, setFixText] = useState<string | null>(null)
  const [editedText, setEditedText] = useState('')
  const [fixApplied, setFixApplied] = useState(false)
  const [recheckResult, setRecheckResult] = useState<{ covered: boolean; reason: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerateFix = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoadingFix(true)
    setError(null)
    setFixApplied(false)
    setRecheckResult(null)
    try {
      const res = await fetch('/api/sdr/fix-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap, persona, dry_run: true }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setFixText(data.fix_text)
      setEditedText(data.fix_text)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao gerar correção. Tente novamente.')
    } finally {
      setLoadingFix(false)
    }
  }

  const handleApplyAndRecheck = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editedText.trim()) return
    setLoadingApply(true)
    setError(null)
    try {
      const applyRes = await fetch('/api/sdr/fix-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gap, persona, fix_text_override: editedText }),
      })
      const applyData = await applyRes.json()
      if (applyData.error) throw new Error(applyData.error)
      setFixApplied(true)
    } catch (err: any) {
      setError(err?.message ?? 'Erro ao aplicar.')
      setLoadingApply(false)
      return
    }
    setLoadingApply(false)

    // Auto-recheck após aplicar (falha silenciosa)
    setLoadingRecheck(true)
    try {
      const recheckRes = await fetch('/api/sdr/recheck-gap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: gap.id }),
      })
      const recheckData = await recheckRes.json()
      if (!recheckData.error) {
        setRecheckResult(recheckData)
        if (recheckData.covered) {
          // Aguarda 1.2s pra usuário ver o sucesso antes de remover da lista
          setTimeout(() => onResolved?.(), 1200)
        }
      }
    } catch {
      // silencioso — o fix foi salvo de qualquer forma
    } finally {
      setLoadingRecheck(false)
    }
  }

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation()
    onNavigate?.(gap.tab_wizard)
    onClose?.()
  }

  return (
    <div className="space-y-3">
      {/* Cabeçalho do gap */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <SeverityDot severity={gap.severity} />
          <SeverityBadge severity={gap.severity} />
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 leading-tight flex-1">
            {gap.scenario}
          </p>
        </div>
        <SourceBadge source={gap.source as ValidationGap['source']} />
      </div>

      {/* Descrição da falha */}
      <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
        {gap.what_fails}
      </p>

      {/* Exemplo de falha */}
      {gap.example && (
        <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1 mb-1.5">
            <MessageSquare size={10} className="text-neutral-400" />
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Exemplo de falha</span>
          </div>
          <div className="space-y-0.5">
            {gap.example.split('\n').map((line, i) => (
              <p key={i} className="text-xs text-neutral-600 dark:text-neutral-300 font-mono leading-relaxed">{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* Sugestão */}
      <div className="flex items-start gap-1.5">
        <AlertCircle size={11} className="shrink-0 mt-0.5" style={{ color: '#01573C' }} />
        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
          {gap.suggestion}
        </p>
      </div>

      {/* Textarea editável */}
      {fixText && !fixApplied && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">
            Script gerado — edite se necessário
          </span>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={5}
            className="w-full text-xs font-mono leading-relaxed bg-neutral-900 dark:bg-neutral-800 text-neutral-200 rounded-lg px-3 py-2.5 border border-neutral-700 focus:border-neutral-500 focus:outline-none resize-y"
          />
        </div>
      )}

      {/* Estado: aplicado + recheck */}
      {fixApplied && (
        <div className="space-y-2">
          {loadingRecheck ? (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Loader2 size={12} className="animate-spin" />
              Verificando se o cenário foi coberto...
            </div>
          ) : recheckResult ? (
            recheckResult.covered ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#01573C]/10 border border-[#01573C]/30 rounded-lg">
                <CheckCircle2 size={14} style={{ color: '#01573C' }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#01573C' }}>Cenário coberto</p>
                  <p className="text-[11px] text-neutral-500">{recheckResult.reason}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Ainda não suficiente</p>
                  <p className="text-[11px] text-neutral-500">{recheckResult.reason} — ajuste e aplique novamente.</p>
                </div>
              </div>
            )
          ) : null}
        </div>
      )}

      {/* Script aplicado (preview) */}
      {fixApplied && fixText && !loadingRecheck && (
        <div className="bg-[#01573C]/5 dark:bg-[#01573C]/10 border border-[#01573C]/20 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Check size={11} style={{ color: '#01573C' }} />
            <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#01573C' }}>
              Adicionado à {gap.source}
            </span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap font-mono line-clamp-3">
            {editedText}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Botões */}
      <div className="flex items-center gap-2 flex-wrap">
        {!fixText && (
          <button
            onClick={handleGenerateFix}
            disabled={loadingFix}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            {loadingFix ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {loadingFix ? 'Gerando...' : 'Gerar correção'}
          </button>
        )}

        {fixText && !fixApplied && (
          <>
            <button
              onClick={handleApplyAndRecheck}
              disabled={loadingApply || !editedText.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#01573C' }}
            >
              {loadingApply ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {loadingApply ? 'Aplicando...' : 'Aplicar na base'}
            </button>
            <button
              onClick={handleGenerateFix}
              disabled={loadingFix}
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
            >
              <Wand2 size={11} />
              {loadingFix ? 'Gerando...' : 'Gerar novamente'}
            </button>
          </>
        )}

        {fixApplied && !loadingRecheck && (
          <>
            {recheckResult && !recheckResult.covered && (
              <button
                onClick={(e) => { setFixApplied(false); setFixText(null); setRecheckResult(null); handleGenerateFix(e) }}
                disabled={loadingFix}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
              >
                <Wand2 size={11} />
                Gerar novamente
              </button>
            )}
            {onNext && recheckResult?.covered !== false && (
              <button
                onClick={onNext}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border-[1.5px] border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400 transition-colors"
              >
                Próxima lacuna
                <ChevronRight size={12} />
              </button>
            )}
          </>
        )}

        {onNavigate && (
          <button
            onClick={handleNavigate}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            <BookOpen size={11} />
            Ver em {gap.source === 'Identidade do Agente' ? 'Identidade' : gap.source === 'Base de Objeções' ? 'Objeções' : 'Conhecimento'}
          </button>
        )}
      </div>
    </div>
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
  const icon =
    source === 'Base de Objeções'
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
