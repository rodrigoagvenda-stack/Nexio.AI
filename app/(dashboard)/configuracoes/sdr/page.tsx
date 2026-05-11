'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import {
  Loader2, Save, MessageSquare, Calendar,
  Zap, Wifi, WifiOff, Bot,
  AlertCircle,
  CheckCircle2, BookOpen, ShieldAlert, LogOut,
  Settings, Brain, Link2, Sparkles, ChevronDown,
  ChevronRight, ChevronLeft, ArrowRight, Plus, Trash2, X,
  ShoppingBag, Pencil, Send, RefreshCw,
  ThumbsUp, AlertTriangle, Star, ChevronUp, Trash,
  Mic, FileImage, FileText,
} from 'lucide-react'
import { NICHES, VAR_LABELS, type NicheTemplate, type SdrVariables, type VariableKey } from '@/lib/sdr/templates'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentPersona {
  nome_agente: string; tom: string; empresa: string
  produto: string; restricoes: string; horario: string
  url_empresa: string; preco: string; periodo_teste: string
  link_teste: string; link_playlist: string; link_agendamento: string
  link_catalogo: string; link_pedido: string; endereco: string
  taxa_entrega: string; tempo_entrega: string; area_entrega: string
  formas_pagamento: string; valor_minimo_pedido: string; pedido_tipo: string
  nicho_id: string
}
interface SdrConfig {
  id?: string; agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  persona: AgentPersona; agente_ativo: boolean; webhook_url: string | null
  instance_status: 'disconnected' | 'connecting' | 'connected'; instance_phone: string | null
  vector_table_conhecimento: string; vector_table_objecoes: string
  conhecimento_ativo: boolean; objecoes_ativo: boolean
  google_calendar_id: string; flow_id: string | null
  inbox_mode: 'suporte' | 'vendas'
  event_title_template: string
}
interface GoogleStatus { connected: boolean; email: string | null }
interface CalendarItem { id: string; summary: string; primary: boolean; backgroundColor?: string }

// ── Helpers ────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2)

const EMPTY_PERSONA: AgentPersona = {
  nome_agente: '', tom: '', empresa: '', produto: '', restricoes: '', horario: '',
  url_empresa: '', preco: '', periodo_teste: '', link_teste: '', link_playlist: '',
  link_agendamento: '', link_catalogo: '', link_pedido: '', endereco: '',
  taxa_entrega: '', tempo_entrega: '', area_entrega: '',
  formas_pagamento: '', valor_minimo_pedido: '', pedido_tipo: '',
  nicho_id: '',
}

function parsePersona(raw: string): AgentPersona {
  if (!raw) return { ...EMPTY_PERSONA }
  try { const p = JSON.parse(raw); if (p && typeof p === 'object') return { ...EMPTY_PERSONA, ...p } } catch {}
  return { ...EMPTY_PERSONA }
}

const AGENT_TYPES = [
  { value: 'atendimento_venda', label: 'Atendimento + Venda', desc: 'Responde dúvidas e conduz para a venda', icon: MessageSquare },
  { value: 'atendimento_venda_agendamento', label: '+ Agendamento', desc: 'Inclui agendamento via Google Calendar', icon: Calendar },
]

const TABS = [
  { id: 'geral', label: 'Geral', icon: Settings, desc: 'Ative o agente, tipo e modo de atendimento' },
  { id: 'identidade', label: 'Identidade', icon: Bot, desc: 'Persona, tom de voz e restrições do agente' },
  { id: 'conhecimento', label: 'Conhecimento', icon: Brain, desc: 'Base de conhecimento e simulador de conversas' },
  { id: 'integracoes', label: 'Integrações', icon: Link2, desc: 'Google Calendar e demais integrações' },
  { id: 'cardapio', label: 'Cardápio', icon: ShoppingBag, desc: 'Produtos e itens para pedidos via WhatsApp' },
] as const
type TabId = typeof TABS[number]['id']

// ── Typeform wizard questions ──────────────────────────────────────────────

interface WizardQuestion {
  key: VariableKey
  question: string
  hint?: string
  placeholder: string
  type: 'text' | 'url' | 'textarea' | 'delivery-zones' | 'payment-chips'
  optional?: boolean
}

const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    key: 'descricao_produto',
    question: 'Como você descreveria o que vende ou oferece?',
    hint: 'Seja específico — isso aparece quando o agente apresenta seu negócio ao cliente.',
    placeholder: 'Ex: sistema de gestão com controle de vendas, estoque e financeiro em um único lugar',
    type: 'textarea',
  },
  {
    key: 'preco',
    question: 'Qual o preço do seu produto ou serviço?',
    placeholder: 'Ex: R$ 49,90/mês',
    type: 'text',
    optional: true,
  },
  {
    key: 'periodo_teste',
    question: 'Você oferece período de teste gratuito? Qual o prazo?',
    placeholder: 'Ex: 7 dias',
    type: 'text',
    optional: true,
  },
  {
    key: 'link_teste',
    question: 'Qual o link para o teste grátis ou aula experimental?',
    placeholder: 'https://',
    type: 'url',
    optional: true,
  },
  {
    key: 'link_playlist',
    question: 'Tem playlist de vídeos ou tutoriais sobre seu produto?',
    placeholder: 'https://youtube.com/...',
    type: 'url',
    optional: true,
  },
  {
    key: 'link_agendamento',
    question: 'Qual o link para agendar uma consulta, avaliação ou visita?',
    placeholder: 'https://',
    type: 'url',
    optional: true,
  },
  {
    key: 'link_catalogo',
    question: 'Tem catálogo, cardápio ou lista de produtos online?',
    placeholder: 'https://',
    type: 'url',
    optional: true,
  },
  {
    key: 'link_pedido',
    question: 'Qual o link para o cliente fazer um pedido ou compra?',
    placeholder: 'https://',
    type: 'url',
    optional: true,
  },
  {
    key: 'horario',
    question: 'Qual o horário de funcionamento do seu negócio?',
    placeholder: 'Ex: Seg–Sex das 9h às 18h, Sáb das 9h às 13h',
    type: 'text',
    optional: true,
  },
  {
    key: 'endereco',
    question: 'Qual o endereço físico do seu negócio?',
    hint: 'Preencha se atende presencialmente.',
    placeholder: 'Ex: Rua das Flores, 123 – Centro, São Paulo',
    type: 'text',
    optional: true,
  },
  {
    key: 'taxa_entrega',
    question: 'Qual a taxa de entrega cobrada?',
    placeholder: 'Ex: R$ 5,00 ou Grátis para pedidos acima de R$ 50',
    type: 'text',
    optional: true,
  },
  {
    key: 'tempo_entrega',
    question: 'Qual o tempo estimado de entrega?',
    placeholder: 'Ex: 40–60 minutos',
    type: 'text',
    optional: true,
  },
  {
    key: 'area_entrega',
    question: 'Quais bairros/zonas vocês atendem e qual a taxa de cada um?',
    hint: 'Adicione uma linha por bairro ou zona. A IA verifica se o endereço do cliente está na área antes de confirmar.',
    placeholder: '',
    type: 'delivery-zones',
    optional: true,
  },
  {
    key: 'formas_pagamento',
    question: 'Quais formas de pagamento vocês aceitam?',
    hint: 'Selecione todas que se aplicam. O agente usará isso ao confirmar o pedido.',
    placeholder: '',
    type: 'payment-chips',
    optional: true,
  },
  {
    key: 'valor_minimo_pedido',
    question: 'Tem valor mínimo de pedido?',
    placeholder: 'Ex: R$ 25,00',
    type: 'text',
    optional: true,
  },
  {
    key: 'pedido_tipo',
    question: 'Como o cliente finaliza o pedido — pelo WhatsApp ou por um link?',
    hint: 'Digite "whatsapp" para o agente coletar o pedido na conversa, ou "link" para redirecionar para o link de pedido.',
    placeholder: 'whatsapp  ou  link',
    type: 'text',
    optional: true,
  },
  {
    key: 'url_empresa',
    question: 'Qual o site da sua empresa?',
    placeholder: 'https://suaempresa.com.br',
    type: 'url',
    optional: true,
  },
]

// Maps VariableKey to the corresponding AgentPersona field name
const WIZARD_KEY_TO_PERSONA: Record<string, keyof AgentPersona> = {
  descricao_produto: 'produto',
  preco: 'preco',
  periodo_teste: 'periodo_teste',
  link_teste: 'link_teste',
  link_playlist: 'link_playlist',
  link_agendamento: 'link_agendamento',
  link_catalogo: 'link_catalogo',
  link_pedido: 'link_pedido',
  horario: 'horario',
  endereco: 'endereco',
  taxa_entrega: 'taxa_entrega',
  tempo_entrega: 'tempo_entrega',
  area_entrega: 'area_entrega',
  formas_pagamento: 'formas_pagamento',
  valor_minimo_pedido: 'valor_minimo_pedido',
  pedido_tipo: 'pedido_tipo',
  url_empresa: 'url_empresa',
}

// ── DeliveryZonesEditor ────────────────────────────────────────────────────

interface DeliveryZone { id: string; bairro: string; taxa: string }

function parseZones(value: string): DeliveryZone[] {
  if (!value.trim()) return []
  return value.split('\n').filter(Boolean).map((line) => {
    const [bairro, taxa] = line.split(/\s*[–-]\s*R\$\s*/)
    return { id: Math.random().toString(36).slice(2), bairro: bairro?.trim() ?? line, taxa: taxa?.trim() ?? '' }
  })
}

function serializeZones(zones: DeliveryZone[]): string {
  return zones.filter((z) => z.bairro.trim()).map((z) => `${z.bairro} – R$ ${z.taxa}`).join('\n')
}

function DeliveryZonesEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [zones, setZones] = useState<DeliveryZone[]>(() => {
    const parsed = parseZones(value)
    return parsed.length > 0 ? parsed : [{ id: 'init', bairro: '', taxa: '' }]
  })

  const update = (updated: DeliveryZone[]) => { setZones(updated); onChange(serializeZones(updated)) }
  const setField = (id: string, field: 'bairro' | 'taxa', val: string) =>
    update(zones.map((z) => z.id === id ? { ...z, [field]: val } : z))
  const addRow = () => update([...zones, { id: Math.random().toString(36).slice(2), bairro: '', taxa: '' }])
  const removeRow = (id: string) => update(zones.filter((z) => z.id !== id))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_100px_32px] gap-1.5 text-[11px] text-muted-foreground font-medium px-1">
        <span>Bairro / Zona</span><span>Taxa (R$)</span><span />
      </div>
      {zones.map((z) => (
        <div key={z.id} className="grid grid-cols-[1fr_100px_32px] gap-1.5 items-center">
          <Input value={z.bairro} onChange={(e) => setField(z.id, 'bairro', e.target.value)} placeholder="Ex: Centro" className="h-8 text-sm" />
          <Input value={z.taxa} onChange={(e) => setField(z.id, 'taxa', e.target.value)} placeholder="5,00" className="h-8 text-sm" />
          <button type="button" onClick={() => removeRow(z.id)} disabled={zones.length === 1}
            className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-30">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
        <Plus className="w-3 h-3" /> Adicionar bairro/zona
      </button>
    </div>
  )
}

// ── PaymentChipsEditor ─────────────────────────────────────────────────────

const PAYMENT_OPTIONS = ['PIX', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'VR / VA', 'Link de pagamento']

function PaymentChipsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : []
  const [custom, setCustom] = useState('')

  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
    onChange(next.join(', '))
  }
  const addCustom = () => {
    const t = custom.trim()
    if (!t || selected.includes(t)) { setCustom(''); return }
    onChange([...selected, t].join(', ')); setCustom('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PAYMENT_OPTIONS.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              selected.includes(opt)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50')}>
            {opt}
          </button>
        ))}
        {selected.filter((s) => !PAYMENT_OPTIONS.includes(s)).map((c) => (
          <span key={c} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground border border-primary">
            {c}<button type="button" onClick={() => toggle(c)}><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <Input value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Outra forma… (Enter para adicionar)" className="h-8 text-sm flex-1" />
        {custom.trim() && (
          <Button size="sm" variant="outline" onClick={addCustom} className="h-8 text-xs"><Plus className="w-3 h-3" /></Button>
        )}
      </div>
    </div>
  )
}

// ── Field ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children, optional }: { label: string; hint?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {optional && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/70">opcional</span>}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

// ── QuestionnaireWizard ────────────────────────────────────────────────────

interface QAnswers {
  identidade: string; produto: string; cliente: string; chegada: string
  proximo_passo: string; precos: string; objecoes: string; limites: string
}

const EMPTY_ANSWERS: QAnswers = {
  identidade: '', produto: '', cliente: '', chegada: '',
  proximo_passo: '', precos: '', objecoes: '', limites: '',
}

const Q_BLOCKS: { key: keyof QAnswers; label: string; question: string; hint: string; placeholder: string; required?: boolean }[] = [
  {
    key: 'identidade', label: '1. Identidade', required: true,
    question: 'Como você descreveria seu negócio em 2–3 frases?',
    hint: 'O que você faz, para quem atende e qual é o principal diferencial.',
    placeholder: 'Ex: Somos uma clínica estética focada em procedimentos não cirúrgicos para mulheres 30+. Nosso diferencial é a avaliação personalizada antes de qualquer procedimento.',
  },
  {
    key: 'produto', label: '2. Produto / Serviço', required: true,
    question: 'O que exatamente você vende ou oferece?',
    hint: 'Liste os principais produtos ou serviços e os benefícios reais para o cliente.',
    placeholder: 'Ex: Botox, preenchimento labial, peeling e limpeza de pele. O benefício é autoestima elevada e resultado visível em até 48h.',
  },
  {
    key: 'cliente', label: '3. Cliente Ideal', required: true,
    question: 'Quem é o seu cliente ideal?',
    hint: 'Perfil, dores, motivações e o que ele busca quando entra em contato.',
    placeholder: 'Ex: Mulher entre 30 e 55 anos, com insegurança sobre envelhecimento. Busca resultado natural, segurança no procedimento e atendimento acolhedor.',
  },
  {
    key: 'chegada', label: '4. Como o Lead Chega',
    question: 'Como os leads chegam até você e o que costumam dizer?',
    hint: 'Canais (anúncio, indicação, Google) e frases típicas na primeira mensagem.',
    placeholder: 'Ex: Maioria vem pelo Instagram. Costumam dizer "vi um post sobre botox" ou "uma amiga me indicou".',
  },
  {
    key: 'proximo_passo', label: '5. Próximo Passo', required: true,
    question: 'Qual ação você quer que o lead tome?',
    hint: 'Agendar consulta, fazer teste, comprar... e como esse processo funciona.',
    placeholder: 'Ex: Agendar uma avaliação gratuita. O link é calendly.com/clinica. A avaliação dura 30 min e é sem compromisso.',
  },
  {
    key: 'precos', label: '6. Preços e Condições',
    question: 'Como funciona o investimento?',
    hint: 'Valores, período de teste, avaliação gratuita, parcelamento ou condições especiais.',
    placeholder: 'Ex: Botox a partir de R$ 800. Avaliação gratuita. Parcelamos em até 12x sem juros no cartão.',
  },
  {
    key: 'objecoes', label: '7. Objeções Comuns',
    question: 'Quais são as 3 objeções mais comuns? Como você costuma responder?',
    hint: 'Para cada objeção, descreva como você responde. A IA vai transformar em scripts.',
    placeholder: 'Ex:\n"Tá caro" → Explico que avaliação é gratuita e parcelamos.\n"Tenho medo de dor" → Mostramos que usamos anestesia e é tranquilo.\n"Vou pensar" → Proponho deixar um horário reservado.',
  },
  {
    key: 'limites', label: '8. Limites do Agente',
    question: 'O que o agente NUNCA deve fazer ou dizer?',
    hint: 'O que deve evitar, limites de assunto e quando transferir para humano.',
    placeholder: 'Ex: Nunca citar preço exato sem avaliação. Nunca fazer diagnóstico. Transferir para humano se pedir orçamento detalhado ou reclamar de procedimento anterior.',
  },
]

function QuestionnaireWizard({
  flowId, type, variables, onSuccess,
}: {
  flowId: string | null
  type: 'conhecimento' | 'objecoes'
  variables: SdrVariables
  onSuccess: (result: { chunks: number }) => void
}) {
  const storageKey = flowId ? `sdr_questionnaire_${flowId}` : null
  const [answers, setAnswers] = useState<QAnswers>(() => {
    if (!storageKey) return { ...EMPTY_ANSWERS }
    try { const saved = localStorage.getItem(storageKey); if (saved) return { ...EMPTY_ANSWERS, ...JSON.parse(saved) } } catch {}
    return { ...EMPTY_ANSWERS }
  })
  const [step, setStep] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const current = Q_BLOCKS[step]
  const total = Q_BLOCKS.length
  const progress = Math.round((step / total) * 100)

  function setAnswer(key: keyof QAnswers, value: string) {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {} }
  }

  useEffect(() => { setTimeout(() => textareaRef.current?.focus(), 80) }, [step])

  const requiredFilled = Q_BLOCKS.filter((b) => b.required).every((b) => answers[b.key].trim())

  async function generate() {
    if (!flowId) { setError('Salve a configuração antes de gerar.'); return }
    setError(null)
    setProcessing(true)
    try {
      const res = await fetch(`/api/sdr/flows/${flowId}/knowledge/from-questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, answers, variables }),
      })
      let data: any
      try { data = await res.json() } catch { throw new Error(`Erro ${res.status}`) }
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      onSuccess({ chunks: data.chunks })
    } catch (err: any) {
      setError(err.message)
    } finally { setProcessing(false) }
  }

  const isLast = step === total - 1

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{current.label}</span>
          <span>{step + 1}/{total}</span>
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress + (100 / total)}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold">{current.question}</p>
          {current.required && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">obrigatório</span>
          )}
        </div>
        {current.hint && <p className="text-xs text-muted-foreground">{current.hint}</p>}
        <textarea
          ref={textareaRef}
          value={answers[current.key]}
          onChange={(e) => setAnswer(current.key, e.target.value)}
          placeholder={current.placeholder}
          rows={5}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
        />
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        {step > 0 && (
          <Button size="sm" variant="outline" onClick={() => setStep((s) => s - 1)} className="h-8 text-xs gap-1">
            <ChevronLeft className="w-3 h-3" /> Anterior
          </Button>
        )}
        {!isLast && (
          <Button size="sm" onClick={() => setStep((s) => s + 1)} className="h-8 text-xs gap-1 ml-auto">
            Próximo <ArrowRight className="w-3 h-3" />
          </Button>
        )}
        {isLast && (
          <Button
            size="sm"
            onClick={generate}
            disabled={processing || !requiredFilled}
            className="h-8 text-xs gap-1.5 ml-auto"
          >
            {processing
              ? <><Loader2 className="w-3 h-3 animate-spin" />Gerando com IA…</>
              : <><Sparkles className="w-3 h-3" />Gerar template personalizado</>}
          </Button>
        )}
      </div>

      {/* Step dots */}
      <div className="flex gap-1 justify-center">
        {Q_BLOCKS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'w-1.5 h-1.5 rounded-full transition-colors',
              i === step ? 'bg-primary' : answers[Q_BLOCKS[i].key].trim() ? 'bg-primary/40' : 'bg-muted-foreground/20'
            )}
          />
        ))}
      </div>

      {!requiredFilled && isLast && (
        <p className="text-xs text-amber-600 text-center">
          Preencha os blocos obrigatórios (1, 2, 3 e 5) antes de gerar.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}
    </div>
  )
}

// ── Knowledge Builder ──────────────────────────────────────────────────────

type KBMode = 'template' | 'form'

interface ExistingBase { filename: string; chunks: number }
interface PendingAction { newName: string; execute: () => void }

function friendlyFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function KnowledgeBuilder({ flowId, type, active, onActiveChange, persona, onPersonaChange, sharedNicheId, onNicheChange }: {
  flowId: string | null; type: 'conhecimento' | 'objecoes'
  active: boolean; onActiveChange: (v: boolean) => void
  persona: AgentPersona
  onPersonaChange: (field: keyof AgentPersona, value: string) => void
  sharedNicheId: string
  onNicheChange: (id: string) => void
}) {
  const [mode, setMode] = useState<KBMode>('template')
  const [processing, setProcessing] = useState(false)
  const [lastResult, setLastResult] = useState<{ chunks: number; table: string } | null>(null)
  const [nicheDropdownOpen, setNicheDropdownOpen] = useState(false)
  const [existingBase, setExistingBase] = useState<ExistingBase | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  // Typeform wizard state
  const [wizardStep, setWizardStep] = useState(0)
  const wizardInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const isConhecimento = type === 'conhecimento'
  const label = isConhecimento ? 'conhecimento' : 'objeções'
  const selectedNiche = NICHES.find((n) => n.id === sharedNicheId)


  useEffect(() => {
    if (!flowId || !active) return
    const url = isConhecimento
      ? `/api/sdr/flows/${flowId}/knowledge`
      : `/api/sdr/flows/${flowId}/objections`
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.exists) setExistingBase({ filename: d.filename, chunks: d.chunks }) })
      .catch(() => {})
  }, [flowId, active, isConhecimento])

  function withConfirm(execute: () => void, newName: string) {
    if (!existingBase) { execute(); return }
    setPendingAction({ newName, execute })
  }

  // Build variables from persona
  const buildVariables = (): SdrVariables => ({
    nome_agente: persona.nome_agente,
    nome_empresa: persona.empresa,
    descricao_produto: persona.produto,
    tom_agente: persona.tom,
    horario: persona.horario,
    url_empresa: persona.url_empresa,
    preco: persona.preco,
    periodo_teste: persona.periodo_teste,
    link_teste: persona.link_teste,
    link_playlist: persona.link_playlist,
    link_agendamento: persona.link_agendamento,
    link_catalogo: persona.link_catalogo,
    link_pedido: persona.link_pedido,
    endereco: persona.endereco,
    taxa_entrega: persona.taxa_entrega,
    tempo_entrega: persona.tempo_entrega,
    area_entrega: persona.area_entrega,
    formas_pagamento: persona.formas_pagamento,
    valor_minimo_pedido: persona.valor_minimo_pedido,
    pedido_tipo: persona.pedido_tipo,
  })

  function getMissingRequired(niche: NicheTemplate): VariableKey[] {
    const vars = buildVariables()
    return niche.requiredVars.filter((k) => !vars[k]?.trim())
  }

  function getMissingOptional(niche: NicheTemplate): VariableKey[] {
    const vars = buildVariables()
    return niche.optionalVars.filter((k) => !vars[k]?.trim())
  }

  async function processTemplate() {
    if (!flowId) { toast({ title: 'Salve a configuração primeiro', variant: 'destructive' }); return }
    if (!sharedNicheId) { toast({ title: 'Selecione um nicho', variant: 'destructive' }); return }
    setProcessing(true)
    try {
      const endpoint = isConhecimento
        ? `/api/sdr/flows/${flowId}/knowledge/from-template`
        : `/api/sdr/flows/${flowId}/objections/from-template`
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicheId: sharedNicheId, variables: buildVariables() }),
      })

      if (res.status === 502 || res.status === 504) {
        throw new Error('Tempo limite excedido. Verifique se a chave OpenAI está configurada em Admin → Configurações de Plataforma, depois tente novamente.')
      }

      let data: any
      try { data = await res.json() } catch {
        throw new Error(`Erro ${res.status}: resposta inválida do servidor`)
      }
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`)
      setLastResult(data)
      setExistingBase({ filename: `${sharedNicheId}_${type}`, chunks: data.chunks })
      toast({ title: `✓ ${data.chunks} chunks processados e salvos!` })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar template', variant: 'destructive' })
    } finally { setProcessing(false) }
  }

  // Wizard questions filtered to niche
  const wizardQuestions = selectedNiche
    ? WIZARD_QUESTIONS.filter((q) =>
        selectedNiche.requiredVars.includes(q.key) ||
        selectedNiche.optionalVars.includes(q.key)
      )
    : WIZARD_QUESTIONS

  const currentQ = wizardQuestions[wizardStep]
  const wizardTotal = wizardQuestions.length
  const wizardProgress = wizardTotal > 0 ? Math.round((wizardStep / wizardTotal) * 100) : 0

  function getWizardValue(q: WizardQuestion): string {
    const personaField = WIZARD_KEY_TO_PERSONA[q.key]
    return personaField ? (persona[personaField] as string) || '' : ''
  }

  function setWizardValue(q: WizardQuestion, value: string) {
    const personaField = WIZARD_KEY_TO_PERSONA[q.key]
    if (personaField) onPersonaChange(personaField, value)
  }

  function handleWizardKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && currentQ?.type !== 'textarea') {
      e.preventDefault()
      if (wizardStep < wizardTotal - 1) setWizardStep((s) => s + 1)
    }
  }

  useEffect(() => {
    if (mode === 'form') {
      setTimeout(() => wizardInputRef.current?.focus(), 80)
    }
  }, [wizardStep, mode])

  const MODES: { id: KBMode; label: string; icon: React.ElementType }[] = [
    { id: 'template', label: 'Nosso padrão', icon: Sparkles },
    { id: 'form', label: 'Guiado', icon: ChevronRight },
  ]

  const vendas = NICHES.filter((n) => n.category === 'vendas' && n.id !== 'monte-o-seu')
  const atendimento = NICHES.filter((n) => n.category === 'atendimento')
  const monteOSeu = NICHES.find((n) => n.id === 'monte-o-seu')
  const isMonteOSeu = sharedNicheId === 'monte-o-seu'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Usar base de {label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isConhecimento
              ? 'O agente consulta estas informações ao responder perguntas'
              : 'O agente usa estas respostas quando o lead levantar objeções'}
          </p>
        </div>
        <Switch checked={active} onCheckedChange={onActiveChange} />
      </div>

      {active && (
        <>
          {/* Mode tabs */}
          <div className="flex gap-0.5 p-1 bg-muted rounded-lg">
            {MODES.map(({ id, label: ml, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all',
                  mode === id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3 h-3 shrink-0" />{ml}
              </button>
            ))}
          </div>

          {/* ── Template mode ── */}
          {mode === 'template' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {isConhecimento
                  ? 'Gera o fluxo de conversa, scripts de venda e comportamento do agente, personalizado para o seu nicho.'
                  : 'Gera scripts de tratamento de objeções — respostas imutáveis e validadas para as objeções mais comuns do seu nicho.'}
              </div>

              {/* Niche selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nicho de atuação</label>
                <div className="relative">
                  <button
                    onClick={() => setNicheDropdownOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-input bg-background text-sm hover:bg-accent transition-colors"
                  >
                    <span className={selectedNiche ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedNiche ? `${selectedNiche.emoji} ${selectedNiche.label}` : 'Selecione o nicho…'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                  {nicheDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-border bg-background shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                      {[{ label: '🎯 Vendas', items: vendas }, { label: '🛎️ Atendimento', items: atendimento }].map((group) => (
                        <div key={group.label}>
                          <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">{group.label}</p>
                          {group.items.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => { onNicheChange(n.id); setNicheDropdownOpen(false) }}
                              className={cn(
                                'w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left',
                                sharedNicheId === n.id && 'bg-primary/5'
                              )}
                            >
                              <span className="text-base shrink-0 mt-0.5">{n.emoji}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{n.label}</p>
                                <p className="text-xs text-muted-foreground">{n.description}</p>
                              </div>
                              {sharedNicheId === n.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-1 ml-auto" />}
                            </button>
                          ))}
                        </div>
                      ))}
                      {monteOSeu && (
                        <div>
                          <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">🛠️ Personalizado</p>
                          <button
                            onClick={() => { onNicheChange(monteOSeu.id); setNicheDropdownOpen(false) }}
                            className={cn(
                              'w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left',
                              isMonteOSeu && 'bg-primary/5'
                            )}
                          >
                            <span className="text-base shrink-0 mt-0.5">{monteOSeu.emoji}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{monteOSeu.label}</p>
                              <p className="text-xs text-muted-foreground">{monteOSeu.description}</p>
                            </div>
                            {isMonteOSeu && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-1 ml-auto" />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Inline variable editor — only for regular niches */}
              {selectedNiche && !isMonteOSeu && (() => {
                const allKeys = [...selectedNiche.requiredVars, ...selectedNiche.optionalVars]
                const allQuestions = WIZARD_QUESTIONS.filter((q) => allKeys.includes(q.key))
                const allFilled = allQuestions.every((q) => !!getWizardValue(q))
                return (
                  <div className="space-y-3">
                    {allQuestions.map((q) => (
                      <div key={q.key} className="space-y-1">
                        <label className="text-xs font-medium flex items-center gap-1.5">
                          {VAR_LABELS[q.key]}
                          {!getWizardValue(q) && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">faltando</span>
                          )}
                        </label>
                        {q.hint && <p className="text-[11px] text-muted-foreground">{q.hint}</p>}
                        {q.type === 'delivery-zones' ? (
                          <DeliveryZonesEditor value={getWizardValue(q)} onChange={(v) => setWizardValue(q, v)} />
                        ) : q.type === 'payment-chips' ? (
                          <PaymentChipsEditor value={getWizardValue(q)} onChange={(v) => setWizardValue(q, v)} />
                        ) : q.type === 'textarea' ? (
                          <Textarea
                            value={getWizardValue(q)}
                            onChange={(e) => setWizardValue(q, e.target.value)}
                            placeholder={q.placeholder}
                            className="min-h-[72px] text-sm resize-none"
                          />
                        ) : (
                          <Input
                            type={q.type === 'url' ? 'url' : 'text'}
                            value={getWizardValue(q)}
                            onChange={(e) => setWizardValue(q, e.target.value)}
                            placeholder={q.placeholder}
                            className="h-9 text-sm"
                          />
                        )}
                      </div>
                    ))}
                    {allFilled && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/5 text-xs text-green-700 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Tudo preenchido. Pronto para gerar.
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Questionnaire — only for Monte o seu */}
              {isMonteOSeu && (
                <QuestionnaireWizard
                  flowId={flowId}
                  type={type}
                  variables={buildVariables()}
                  onSuccess={(result) => {
                    setLastResult({ chunks: result.chunks, table: type })
                    setExistingBase({ filename: `${type}_monte-o-seu`, chunks: result.chunks })
                    toast({ title: `✓ ${result.chunks} chunks processados e salvos!` })
                  }}
                />
              )}

              {!isMonteOSeu && (
                <Button
                  size="sm"
                  onClick={() => withConfirm(processTemplate, selectedNiche ? `${selectedNiche.emoji} ${selectedNiche.label}` : 'template')}
                  disabled={processing || !flowId || !sharedNicheId}
                  className="gap-1.5 text-xs h-8 w-full"
                >
                  {processing
                    ? <><Loader2 className="w-3 h-3 animate-spin" />Processando…</>
                    : <><Sparkles className="w-3 h-3" />Gerar e processar template</>}
                </Button>
              )}
            </div>
          )}

          {/* ── Form mode — Typeform wizard ── */}
          {mode === 'form' && (
            <div className="space-y-4">
              {/* Niche selector (shared) */}
              {!sharedNicheId && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Primeiro, selecione o nicho para filtrar as perguntas relevantes.</p>
                  <div className="relative">
                    <button
                      onClick={() => setNicheDropdownOpen((o) => !o)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-input bg-background text-sm hover:bg-accent transition-colors"
                    >
                      <span className="text-muted-foreground">Selecione o nicho…</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                    {nicheDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-border bg-background shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                        {[{ label: '🎯 Vendas', items: vendas }, { label: '🛎️ Atendimento', items: atendimento }].map((group) => (
                          <div key={group.label}>
                            <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">{group.label}</p>
                            {group.items.map((n) => (
                              <button key={n.id} onClick={() => { onNicheChange(n.id); setNicheDropdownOpen(false) }}
                                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left">
                                <span className="text-base shrink-0 mt-0.5">{n.emoji}</span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{n.label}</p>
                                  <p className="text-xs text-muted-foreground">{n.description}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Wizard steps */}
              {wizardQuestions.length > 0 && wizardStep < wizardTotal && (
                <div className="space-y-4">
                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{wizardStep + 1} de {wizardTotal}</span>
                      {currentQ?.optional && <span className="text-amber-600 dark:text-amber-400">opcional</span>}
                    </div>
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${wizardProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Question card */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <p className="text-sm font-semibold leading-snug">{currentQ?.question}</p>
                    {currentQ?.hint && <p className="text-[11px] text-muted-foreground">{currentQ.hint}</p>}
                    {currentQ?.type === 'delivery-zones' ? (
                      <DeliveryZonesEditor value={getWizardValue(currentQ)} onChange={(v) => setWizardValue(currentQ, v)} />
                    ) : currentQ?.type === 'payment-chips' ? (
                      <PaymentChipsEditor value={getWizardValue(currentQ)} onChange={(v) => setWizardValue(currentQ, v)} />
                    ) : currentQ?.type === 'textarea' ? (
                      <Textarea
                        ref={wizardInputRef as React.RefObject<HTMLTextAreaElement>}
                        value={getWizardValue(currentQ)}
                        onChange={(e) => setWizardValue(currentQ, e.target.value)}
                        placeholder={currentQ.placeholder}
                        className="min-h-[72px] text-sm resize-none"
                      />
                    ) : (
                      <Input
                        ref={wizardInputRef as React.RefObject<HTMLInputElement>}
                        type={currentQ?.type === 'url' ? 'url' : 'text'}
                        value={getWizardValue(currentQ!)}
                        onChange={(e) => setWizardValue(currentQ!, e.target.value)}
                        placeholder={currentQ?.placeholder}
                        className="h-9 text-sm"
                        onKeyDown={handleWizardKeyDown}
                      />
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setWizardStep((s) => Math.max(0, s - 1))}
                      disabled={wizardStep === 0}
                      className="gap-1.5 text-xs h-8"
                    >
                      <ChevronLeft className="w-3 h-3" />Anterior
                    </Button>
                    {wizardStep < wizardTotal - 1 ? (
                      <Button
                        size="sm"
                        onClick={() => setWizardStep((s) => s + 1)}
                        className="gap-1.5 text-xs h-8 flex-1"
                      >
                        Próxima <ArrowRight className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => withConfirm(processTemplate, selectedNiche ? `${selectedNiche.emoji} ${selectedNiche.label}` : 'guiado')}
                        disabled={processing || !flowId || !sharedNicheId}
                        className="gap-1.5 text-xs h-8 flex-1"
                      >
                        {processing
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Processando…</>
                          : <><Sparkles className="w-3 h-3" />Gerar base de {label}</>}
                      </Button>
                    )}
                  </div>

                  {wizardStep < wizardTotal - 1 && (
                    <button
                      onClick={() => setWizardStep(wizardTotal - 1)}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 w-full text-center transition-colors"
                    >
                      Pular e ir para o final →
                    </button>
                  )}
                </div>
              )}

              {/* Summary after wizard */}
              {wizardStep >= wizardTotal && wizardTotal > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/5 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Todas as respostas preenchidas!
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setWizardStep(0)} className="text-xs h-8 gap-1.5">
                      <ChevronLeft className="w-3 h-3" />Revisar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => withConfirm(processTemplate, selectedNiche ? `${selectedNiche.emoji} ${selectedNiche.label}` : 'guiado')}
                      disabled={processing || !flowId || !sharedNicheId}
                      className="gap-1.5 text-xs h-8 flex-1"
                    >
                      {processing
                        ? <><Loader2 className="w-3 h-3 animate-spin" />Processando…</>
                        : <><Sparkles className="w-3 h-3" />Gerar base de {label}</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {pendingAction && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">Substituir base de {label}?</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Você possui <span className="font-medium text-foreground">"{friendlyFilename(existingBase!.filename)}"</span> cadastrada ({existingBase!.chunks} chunks).
                    Ao prosseguir, ela será <span className="text-destructive font-medium">permanentemente deletada</span> e substituída por{' '}
                    <span className="font-medium text-foreground">"{friendlyFilename(pendingAction.newName)}"</span>.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pl-6">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    const action = pendingAction.execute
                    setPendingAction(null)
                    setExistingBase(null)
                    action()
                  }}
                >
                  <ShieldAlert className="w-3 h-3" />Substituir
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPendingAction(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {lastResult && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Base salva — {lastResult.chunks} chunks · <code className="font-mono">{lastResult.table}</code>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Calendar Section ───────────────────────────────────────────────────────

function CalendarSection({ calendarId, onCalendarIdChange }: {
  calendarId: string; onCalendarIdChange: (id: string) => void
}) {
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ connected: false, email: null })
  const [calendars, setCalendars] = useState<CalendarItem[]>([])
  const [loadingCals, setLoadingCals] = useState(false)
  const [calError, setCalError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/google/status').then((r) => r.json()).then((d) => setGoogleStatus({ connected: d.connected, email: d.email })).catch(() => {})
  }, [])

  useEffect(() => {
    if (!googleStatus.connected) return
    setLoadingCals(true); setCalError(null)
    fetch('/api/google/calendars')
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); setCalendars(d.calendars ?? []) })
      .catch((err) => setCalError(err.message))
      .finally(() => setLoadingCals(false))
  }, [googleStatus.connected])

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/google/status', { method: 'DELETE' })
      setGoogleStatus({ connected: false, email: null }); setCalendars([]); onCalendarIdChange('')
    } finally { setDisconnecting(false) }
  }

  if (!googleStatus.connected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Conecte uma conta Google com acesso ao Calendar para habilitar o agendamento automático.</p>
        <Button variant="outline" onClick={() => { window.location.href = '/api/google/auth' }} className="gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Conectar com Google
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <span className="font-mono text-foreground truncate">{googleStatus.email}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect} disabled={disconnecting} className="text-xs text-muted-foreground gap-1.5 h-7 shrink-0">
          {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}Desconectar
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Calendário para agendamentos</label>
        {loadingCals ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando calendários…</div>
        ) : calError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>Erro ao carregar calendários: {calError}</span>
          </div>
        ) : calendars.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Nenhum calendário encontrado. <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="underline">Crie um em calendar.google.com</a> e recarregue.</span>
          </div>
        ) : (
          <div className="grid gap-2">
            {calendars.map((cal) => (
              <button key={cal.id} onClick={() => onCalendarIdChange(cal.id ?? '')}
                className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all text-left', calendarId === cal.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50')}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cal.backgroundColor || '#4285F4' }} />
                <span className="flex-1 truncate font-medium">{cal.summary}</span>
                {cal.primary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Principal</span>}
                {calendarId === cal.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Catalog Manager ───────────────────────────────────────────────────────

interface CatalogProduct { id: number; numero: number; nome: string; descricao: string | null; preco: number | null; ativo: boolean }
interface ProductFormData { numero: string; nome: string; descricao: string; preco: string; ativo: boolean }
const EMPTY_PRODUCT: ProductFormData = { numero: '', nome: '', descricao: '', preco: '', ativo: true }

function CatalogManager() {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ProductFormData>(EMPTY_PRODUCT)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState<ProductFormData>(EMPTY_PRODUCT)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/sdr/products')
      const data = await res.json()
      setProducts(data.products ?? [])
    } catch { toast({ title: 'Erro ao carregar produtos', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  async function addProduct() {
    if (!addForm.numero || !addForm.nome) { toast({ title: 'Número e nome são obrigatórios', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const res = await fetch('/api/sdr/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: parseInt(addForm.numero), nome: addForm.nome, descricao: addForm.descricao || null, preco: addForm.preco ? parseFloat(addForm.preco.replace(',', '.')) : null, ativo: addForm.ativo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProducts((prev) => [...prev, data.product].sort((a, b) => a.numero - b.numero))
      setAdding(false); setAddForm(EMPTY_PRODUCT)
      toast({ title: 'Produto adicionado!' })
    } catch (err: any) { toast({ title: err.message || 'Erro ao adicionar', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  async function saveEdit() {
    if (!editingId || !editForm.numero || !editForm.nome) { toast({ title: 'Número e nome são obrigatórios', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const res = await fetch('/api/sdr/products', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingId, numero: parseInt(editForm.numero), nome: editForm.nome, descricao: editForm.descricao || null, preco: editForm.preco ? parseFloat(editForm.preco.replace(',', '.')) : null, ativo: editForm.ativo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProducts((prev) => prev.map((p) => p.id === editingId ? data.product : p).sort((a, b) => a.numero - b.numero))
      setEditingId(null)
      toast({ title: 'Produto salvo!' })
    } catch (err: any) { toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  async function deleteProduct(id: number) {
    try {
      const res = await fetch('/api/sdr/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!res.ok) throw new Error((await res.json()).error)
      setProducts((prev) => prev.filter((p) => p.id !== id))
      toast({ title: 'Produto removido' })
    } catch (err: any) { toast({ title: err.message || 'Erro ao remover', variant: 'destructive' }) }
  }

  async function toggleAtivo(product: CatalogProduct) {
    try {
      const res = await fetch('/api/sdr/products', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: product.id, ativo: !product.ativo }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProducts((prev) => prev.map((p) => p.id === product.id ? data.product : p))
    } catch (err: any) { toast({ title: err.message || 'Erro ao atualizar', variant: 'destructive' }) }
  }

  function startEdit(p: CatalogProduct) {
    setEditingId(p.id)
    setEditForm({ numero: String(p.numero), nome: p.nome, descricao: p.descricao ?? '', preco: p.preco != null ? String(p.preco) : '', ativo: p.ativo })
    setAdding(false)
  }

  function ProductFormRow({ form, onChange, onSave, onCancel }: { form: ProductFormData; onChange: (f: ProductFormData) => void; onSave: () => void; onCancel: () => void }) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-3">
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Nº *</label>
            <Input type="number" value={form.numero} onChange={(e) => onChange({ ...form, numero: e.target.value })} placeholder="1" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Nome *</label>
            <Input value={form.nome} onChange={(e) => onChange({ ...form, nome: e.target.value })} placeholder="Ex: X-Burguer Duplo" className="h-8 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Descrição</label>
          <Input value={form.descricao} onChange={(e) => onChange({ ...form, descricao: e.target.value })} placeholder="Ex: 2 hambúrgueres, queijo, alface, tomate" className="h-8 text-sm" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Preço (R$)</label>
            <Input value={form.preco} onChange={(e) => onChange({ ...form, preco: e.target.value })} placeholder="Ex: 29,90" className="h-8 text-sm" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer h-8 pb-0.5">
            <Switch checked={form.ativo} onCheckedChange={(v) => onChange({ ...form, ativo: v })} />
            Ativo
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onSave} disabled={saving} className="h-7 text-xs gap-1.5 flex-1">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}Salvar
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs">Cancelar</Button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Cadastre os itens do cardápio. O agente usa a lista para identificar pedidos por número — ex: "quero o item 30".
      </div>

      {products.length === 0 && !adding && (
        <div className="text-center py-8 text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</div>
      )}

      {products.map((p) =>
        editingId === p.id ? (
          <ProductFormRow key={p.id} form={editForm} onChange={setEditForm} onSave={saveEdit} onCancel={() => setEditingId(null)} />
        ) : (
          <div key={p.id} className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors', p.ativo ? 'border-border bg-card' : 'border-border/50 bg-muted/30 opacity-60')}>
            <span className="text-[11px] font-mono font-semibold text-muted-foreground w-7 shrink-0">#{p.numero}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.nome}</p>
              {p.descricao && <p className="text-[11px] text-muted-foreground truncate">{p.descricao}</p>}
            </div>
            {p.preco != null && (
              <span className="text-xs font-semibold shrink-0">R$ {Number(p.preco).toFixed(2).replace('.', ',')}</span>
            )}
            <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
            <button onClick={() => startEdit(p)} className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      )}

      {adding && (
        <ProductFormRow form={addForm} onChange={setAddForm} onSave={addProduct} onCancel={() => { setAdding(false); setAddForm(EMPTY_PRODUCT) }} />
      )}

      {!adding && (
        <button onClick={() => { setAdding(true); setEditingId(null) }} className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
          <Plus className="w-3.5 h-3.5" />Adicionar produto
        </button>
      )}
    </div>
  )
}

// ── SimulatorChat ──────────────────────────────────────────────────────────

type SimMode = 'inbound' | 'outbound'
interface SimMessage { role: 'user' | 'assistant'; content: string }
interface SimFeedback { score: number; positivo: string; melhorar: string | null }
interface SimTurn { userMsg: string; sdrMsgs: string[]; feedback: SimFeedback; ts: string }

type SdrMsgType = 'text' | 'image' | 'audio' | 'doc'
interface ParsedMsg { type: SdrMsgType; content: string }

function parseSdrMsg(msg: string): ParsedMsg {
  const m = msg.trim()
  if (m === '[FOTO]' || m === '[IMAGEM]') return { type: 'image', content: '' }
  if (m === '[AUDIO]' || m === '[VOZ]') return { type: 'audio', content: '' }
  const doc = m.match(/^\[PDF:\s*(.+?)\]$/)
  if (doc) return { type: 'doc', content: doc[1] }
  return { type: 'text', content: m }
}

const WAVEFORM = [6, 14, 8, 20, 12, 18, 6, 16, 22, 10, 18, 8, 14, 20, 6, 12, 18, 10, 16, 8]

function AudioBubble() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl rounded-tl-none bg-card border border-border/60 shadow-sm min-w-[180px]">
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
        <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="flex items-end gap-0.5 flex-1 h-6">
        {WAVEFORM.map((h, i) => (
          <div key={i} className="w-0.5 rounded-full bg-muted-foreground/35" style={{ height: `${h}px` }} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground/50 shrink-0">0:08</span>
    </div>
  )
}

function ImageBubble({ caption }: { caption?: string }) {
  return (
    <div className="rounded-2xl rounded-tl-none overflow-hidden border border-border/60 shadow-sm w-48">
      <div className="h-32 bg-muted/50 flex flex-col items-center justify-center gap-1.5">
        <FileImage className="w-7 h-7 text-muted-foreground/40" />
        <span className="text-[11px] text-muted-foreground/60">Foto</span>
      </div>
      {caption && <p className="text-xs px-3 py-1.5 bg-card border-t border-border/40">{caption}</p>}
    </div>
  )
}

function DocBubble({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl rounded-tl-none bg-card border border-border/60 shadow-sm min-w-[180px] max-w-[220px]">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="w-4.5 h-4.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">PDF · Documento</p>
      </div>
    </div>
  )
}

function SdrMsgBubble({ msg }: { msg: string }) {
  const parsed = parseSdrMsg(msg)
  if (parsed.type === 'audio') return <AudioBubble />
  if (parsed.type === 'image') return <ImageBubble />
  if (parsed.type === 'doc') return <DocBubble name={parsed.content} />
  return (
    <div className="rounded-2xl rounded-tl-none bg-card border border-border/60 px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">
      {parsed.content}
    </div>
  )
}

function now() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  )
}

function FeedbackPill({ feedback, onApply, applying, applied }: {
  feedback: SimFeedback
  onApply?: () => void
  applying?: boolean
  applied?: boolean
}) {
  const [open, setOpen] = useState(false)
  const scoreColor = feedback.score >= 8 ? 'text-emerald-500' : feedback.score >= 6 ? 'text-amber-500' : 'text-red-500'
  return (
    <div className="mt-1 ml-9">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        <Star className={cn('w-2.5 h-2.5', scoreColor)} />
        <span className={cn('font-semibold', scoreColor)}>{feedback.score}/10</span>
        <span>· Nexio AI</span>
        {open ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-border/50 bg-card px-3 py-2 space-y-1.5 text-[11px]">
          {feedback.positivo && (
            <div className="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400">
              <ThumbsUp className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{feedback.positivo}</span>
            </div>
          )}
          {feedback.melhorar && (
            <div className="flex items-start justify-between gap-2 text-amber-600 dark:text-amber-400">
              <div className="flex items-start gap-1.5 min-w-0">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{feedback.melhorar}</span>
              </div>
              {applied ? (
                <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Salvo
                </span>
              ) : onApply && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onApply() }}
                  disabled={applying}
                  className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[10px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  {applying ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
                  Aplicar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SimulatorChat({ nicheId, variables, flowId }: { nicheId: string; variables: Record<string, string>; flowId: string | null }) {
  const storageKey = flowId && nicheId ? `sdr_sim_${flowId}_${nicheId}` : null

  const normalizeTurns = (raw: any[]): SimTurn[] =>
    raw.map((t) => ({ ...t, sdrMsgs: t.sdrMsgs ?? (t.sdrMsg ? [t.sdrMsg] : ['...']) }))

  const [turns, setTurns] = useState<SimTurn[]>(() => {
    if (!storageKey) return []
    try { const s = localStorage.getItem(storageKey); if (s) return normalizeTurns(JSON.parse(s)) } catch {}
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null)
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<SimMode>('inbound')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const niche = NICHES.find((n) => n.id === nicheId)
  const missingRequired = niche ? niche.requiredVars.filter((k) => !variables[k]?.trim()) : []
  const agentName = variables.nome_agente || 'Agente'

  function saveTurns(next: SimTurn[]) {
    setTurns(next)
    if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {} }
  }

  function clearHistory() {
    saveTurns([])
    setError(null)
  }

  // Reload history when niche changes
  useEffect(() => {
    if (!storageKey) { setTurns([]); setAppliedIndices(new Set()); return }
    try {
      const s = localStorage.getItem(storageKey)
      setTurns(s ? normalizeTurns(JSON.parse(s)) : [])
    } catch { setTurns([]) }
    setAppliedIndices(new Set())
    setError(null)
  }, [storageKey])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [turns, loading])

  const history: SimMessage[] = turns.flatMap((t) => [
    { role: 'user', content: t.userMsg },
    { role: 'assistant', content: t.sdrMsgs.filter((m) => !parseSdrMsg(m).type.match(/image|audio|doc/)).join('\n') },
  ])

  async function send() {
    const msg = input.trim()
    if (!msg || loading) return
    setInput('')
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/sdr/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicheId, variables, history, userMessage: msg, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao simular')
      saveTurns([...turns, { userMsg: msg, sdrMsgs: data.sdrMessages ?? [data.sdrResponse ?? '...'], feedback: data.feedback, ts: now() }])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function applyCorrection(index: number) {
    const turn = turns[index]
    if (!turn?.feedback.melhorar || applyingIndex !== null || !flowId) return
    setApplyingIndex(index)
    try {
      const res = await fetch(`/api/sdr/flows/${flowId}/knowledge/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correction: turn.feedback.melhorar,
          type: 'conhecimento',
          userMsg: turn.userMsg,
          sdrMsg: turn.sdrMsgs.filter((m) => parseSdrMsg(m).type === 'text').join('\n'),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar correção')
      setAppliedIndices((prev) => new Set(prev).add(index))
      toast({ title: '✓ Correção salva na base de conhecimento' })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao aplicar correção', variant: 'destructive' })
    } finally { setApplyingIndex(null) }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (!nicheId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 py-12">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-5 h-5 opacity-40" />
        </div>
        <div>
          <p className="text-sm font-medium">Simulador inativo</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Selecione um nicho ao lado para ativar</p>
        </div>
      </div>
    )
  }

  if (missingRequired.length > 0) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Campos obrigatórios faltando
          </div>
          <ul className="text-xs text-amber-600/80 space-y-1 pl-6 list-disc">
            {missingRequired.map((k) => <li key={k}>{VAR_LABELS[k as VariableKey] ?? k}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">Preencha na aba <strong>Identidade</strong> e volte aqui.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── WhatsApp header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-card shrink-0">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5 text-primary" />
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none truncate">{agentName}</p>
          <p className="text-[11px] text-emerald-500 mt-0.5">online · {niche?.label}</p>
        </div>
        <div className="flex items-center gap-1">
          {turns.length > 0 && (
            <>
              <button
                type="button"
                onClick={clearHistory}
                title="Apagar histórico"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { saveTurns([]); setError(null) }}
                title="Novo chat"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 min-h-0" style={{ background: 'var(--sim-bg, hsl(var(--muted)/0.3))' }}>
        {turns.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-8 text-center">
            <div className="px-3 py-1.5 rounded-full bg-muted/60 text-[11px] text-muted-foreground/70 border border-border/40">
              Simulação iniciada · {niche?.label}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1">Digite como um lead chegando pelo WhatsApp</p>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-1">
            {/* Lead message — right */}
            <div className="flex justify-end">
              <div className="max-w-[75%]">
                <div className="rounded-2xl rounded-tr-none bg-emerald-600 text-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">
                  {turn.userMsg}
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5 pr-1">{turn.ts}</p>
              </div>
            </div>

            {/* SDR messages — left, one bubble per message */}
            <div className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-4">
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className="max-w-[75%] space-y-1">
                {turn.sdrMsgs.map((msg, j) => (
                  <SdrMsgBubble key={j} msg={msg} />
                ))}
                <p className="text-[10px] text-muted-foreground/50 mt-0.5 pl-1">{turn.ts}</p>
                <FeedbackPill
                  feedback={turn.feedback}
                  onApply={turn.feedback.melhorar && flowId ? () => applyCorrection(i) : undefined}
                  applying={applyingIndex === i}
                  applied={appliedIndices.has(i)}
                />
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="w-3 h-3 text-primary" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-card border border-border/60 px-3 py-2 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        {error && (
          <div className="mx-2 flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Mode toggle + Input ── */}
      <div className="border-t border-border/60 bg-card shrink-0">
        {/* Inbound / Outbound toggle */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1">
          <span className="text-[10px] text-muted-foreground/60 mr-1">Modo:</span>
          {(['inbound', 'outbound'] as SimMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                mode === m
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground'
              )}
            >
              {m === 'inbound' ? 'Inbound' : 'Outbound'}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground/40 ml-auto">
            {mode === 'inbound' ? 'Lead chegou até você' : 'Você abordou o lead'}
          </span>
        </div>

        {/* Text input */}
        <div className="flex gap-2 items-end px-3 pb-3">
          <div className="flex-1 flex items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:border-primary/40 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mensagem…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-50 max-h-28 leading-5"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          </div>
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function SdrConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>('geral')
  const [config, setConfig] = useState<SdrConfig>({
    agent_type: 'atendimento_venda',
    persona: { ...EMPTY_PERSONA },
    agente_ativo: false, webhook_url: null,
    instance_status: 'disconnected', instance_phone: null,
    vector_table_conhecimento: '', vector_table_objecoes: '',
    conhecimento_ativo: true, objecoes_ativo: false,
    google_calendar_id: '', flow_id: null, inbox_mode: 'suporte',
    event_title_template: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Shared niche selection across KnowledgeBuilders
  const [sharedNicheId, setSharedNicheId] = useState('')
  const [identNicheOpen, setIdentNicheOpen] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const [configRes, statusRes] = await Promise.all([fetch('/api/sdr/config'), fetch('/api/sdr/status')])
      const data = await configRes.json()
      const liveStatus = statusRes.ok ? await statusRes.json() : null
      if (data.config) {
        const persona = parsePersona(data.config.prompt ?? '')
        setConfig({
          id: data.config.id,
          agent_type: data.config.agent_type ?? 'atendimento_venda',
          persona,
          agente_ativo: data.config.agente_ativo ?? false,
          webhook_url: data.config.webhook_url ?? null,
          instance_status: liveStatus?.status ?? data.config.instance_status ?? 'disconnected',
          instance_phone: liveStatus?.phone ?? data.config.instance_phone ?? null,
          vector_table_conhecimento: data.config.vector_table_conhecimento ?? '',
          vector_table_objecoes: data.config.vector_table_objecoes ?? '',
          conhecimento_ativo: data.config.conhecimento_ativo ?? true,
          objecoes_ativo: data.config.objecoes_ativo ?? false,
          google_calendar_id: data.config.google_calendar_id ?? '',
          flow_id: data.config.flow_id ?? null,
          inbox_mode: data.config.inbox_mode ?? 'suporte',
          event_title_template: data.config.event_title_template ?? '',
        })
        if (persona.nicho_id) setSharedNicheId(persona.nicho_id)
      }
    } catch { toast({ title: 'Erro ao carregar configuração', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const setPersona = (field: keyof AgentPersona, value: string) =>
    setConfig((prev) => ({ ...prev, persona: { ...prev.persona, [field]: value } }))

  function handleNicheChange(id: string) {
    setSharedNicheId(id)
    setPersona('nicho_id', id)
    const niche = NICHES.find((n) => n.id === id)
    if (niche) setPersona('produto', niche.label)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sdr/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: config.agent_type,
          prompt: JSON.stringify({ ...config.persona, nicho_id: sharedNicheId }),
          agente_ativo: config.agente_ativo,
          google_calendar_id: config.google_calendar_id,
          event_title_template: config.event_title_template || null,
          vector_table_conhecimento: config.vector_table_conhecimento,
          vector_table_objecoes: config.vector_table_objecoes,
          conhecimento_ativo: config.conhecimento_ativo,
          objecoes_ativo: config.objecoes_ativo,
          inbox_mode: config.inbox_mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.config?.flow_id && !config.flow_id) {
        setConfig((prev) => ({ ...prev, flow_id: data.config.flow_id }))
      }
      toast({ title: 'Configuração salva!' })
      await loadConfig()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const isConnected = config.instance_status === 'connected'
  const isConnecting = config.instance_status === 'connecting'
  const needsAgendamento = config.agent_type === 'atendimento_venda_agendamento'

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>

  const simVariables = {
    nome_agente: config.persona.nome_agente,
    nome_empresa: config.persona.empresa,
    descricao_produto: config.persona.produto,
    tom_agente: config.persona.tom,
    horario: config.persona.horario,
    url_empresa: config.persona.url_empresa,
    preco: config.persona.preco,
    periodo_teste: config.persona.periodo_teste,
    link_teste: config.persona.link_teste,
    link_playlist: config.persona.link_playlist,
    link_agendamento: config.persona.link_agendamento,
    link_catalogo: config.persona.link_catalogo,
    link_pedido: config.persona.link_pedido,
    endereco: config.persona.endereco,
    taxa_entrega: config.persona.taxa_entrega,
    tempo_entrega: config.persona.tempo_entrega,
    area_entrega: config.persona.area_entrega,
    formas_pagamento: config.persona.formas_pagamento,
    valor_minimo_pedido: config.persona.valor_minimo_pedido,
    pedido_tipo: config.persona.pedido_tipo,
  }

  const identSelectedNiche = NICHES.find((n) => n.id === sharedNicheId)
  const identVendas = NICHES.filter((n) => n.category === 'vendas' && n.id !== 'monte-o-seu')
  const identAtendimento = NICHES.filter((n) => n.category === 'atendimento')

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agente SDR</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Atendimento automático via WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            isConnected ? 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400'
              : isConnecting ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400'
              : 'bg-muted text-muted-foreground border-border')}>
            {isConnected ? <Wifi className="w-3 h-3" /> : isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? config.instance_phone || 'Conectado' : isConnecting ? 'Conectando' : 'Desconectado'}
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 h-8">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-6">

        {/* ── Sidebar ── */}
        <aside className="w-44 shrink-0 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                activeTab === id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className={cn('w-4 h-4 shrink-0', activeTab === id ? 'text-primary' : 'text-muted-foreground')} />
              {label}
            </button>
          ))}
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">

          {/* Non-conhecimento tabs: card layout */}
          {activeTab !== 'conhecimento' && (() => {
            const tab = TABS.find((t) => t.id === activeTab)!
            const TabIcon = tab.icon
            return (
              <div className="rounded-xl border border-border overflow-hidden">
                {/* Card header */}
                <div className="flex items-center gap-3 px-5 py-4 bg-muted/20 border-b border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <TabIcon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{tab.label}</p>
                    <p className="text-xs text-muted-foreground">{tab.desc}</p>
                  </div>
                  {activeTab === 'geral' && (
                    <div className={cn(
                      'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0',
                      config.agente_ativo
                        ? 'bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400'
                        : 'bg-muted text-muted-foreground border-border'
                    )}>
                      <Zap className="w-3 h-3" />
                      {config.agente_ativo ? 'Ativo' : 'Inativo'}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-5">

                  {/* ── Geral ── */}
                  {activeTab === 'geral' && (
                    <div className="space-y-5">
                      <div className={cn('flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors',
                        config.agente_ativo ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border')}>
                        <div className="flex items-center gap-3">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', config.agente_ativo ? 'bg-primary/15' : 'bg-muted')}>
                            <Zap className={cn('w-4 h-4', config.agente_ativo ? 'text-primary' : 'text-muted-foreground')} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Agente ativo</p>
                            <p className="text-xs text-muted-foreground">{config.agente_ativo ? 'Respondendo automaticamente' : 'Ative para responder automaticamente'}</p>
                          </div>
                        </div>
                        <Switch checked={config.agente_ativo} onCheckedChange={(v) => setConfig((p) => ({ ...p, agente_ativo: v }))} />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de agente</p>
                        <div className="grid grid-cols-2 gap-2">
                          {AGENT_TYPES.map((opt) => {
                            const Icon = opt.icon; const selected = config.agent_type === opt.value
                            return (
                              <button key={opt.value} onClick={() => setConfig((p) => ({ ...p, agent_type: opt.value as any }))}
                                className={cn('text-left p-3 rounded-xl border transition-all', selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40')}>
                                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', selected ? 'bg-primary/15' : 'bg-muted')}>
                                  <Icon className={cn('w-3.5 h-3.5', selected ? 'text-primary' : 'text-muted-foreground')} />
                                </div>
                                <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Modo de atendimento</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'suporte', label: 'Suporte', desc: 'Inbox compartilhado — qualquer atendente pode pegar' },
                            { value: 'vendas', label: 'Vendas', desc: 'Distribui automaticamente entre os atendentes (round-robin)' },
                          ] as const).map((opt) => {
                            const selected = config.inbox_mode === opt.value
                            return (
                              <button key={opt.value} onClick={() => setConfig((p) => ({ ...p, inbox_mode: opt.value }))}
                                className={cn('text-left p-3 rounded-xl border transition-all', selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40')}>
                                <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Identidade ── */}
                  {activeTab === 'identidade' && (
                    <div className="space-y-4">
                      <Field label="Nicho" hint="Segmento de atuação da empresa. Define o comportamento base do agente.">
                        <div className="relative">
                          <button
                            onClick={() => setIdentNicheOpen((o) => !o)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-input bg-background text-sm hover:bg-accent transition-colors"
                          >
                            <span className={identSelectedNiche ? 'text-foreground' : 'text-muted-foreground'}>
                              {identSelectedNiche ? `${identSelectedNiche.emoji} ${identSelectedNiche.label}` : 'Selecione o nicho…'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                          {identNicheOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-border bg-background shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                              {[{ label: '🎯 Vendas', items: identVendas }, { label: '🛎️ Atendimento', items: identAtendimento }].map((group) => (
                                <div key={group.label}>
                                  <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">{group.label}</p>
                                  {group.items.map((n) => (
                                    <button
                                      key={n.id}
                                      onClick={() => { handleNicheChange(n.id); setIdentNicheOpen(false) }}
                                      className={cn(
                                        'w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left',
                                        sharedNicheId === n.id && 'bg-primary/5'
                                      )}
                                    >
                                      <span className="text-base shrink-0 mt-0.5">{n.emoji}</span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium">{n.label}</p>
                                        <p className="text-xs text-muted-foreground">{n.description}</p>
                                      </div>
                                      {sharedNicheId === n.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-1 ml-auto" />}
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </Field>
                      <Field label="Nome do agente">
                        <Input value={config.persona.nome_agente} onChange={(e) => setPersona('nome_agente', e.target.value)} placeholder="Ex: Ana, João, Sofia" className="h-9 text-sm" />
                      </Field>
                      <Field label="Nome da empresa">
                        <Input value={config.persona.empresa} onChange={(e) => setPersona('empresa', e.target.value)} placeholder="Ex: Clínica Silva, Tocli, Studio Bella" className="h-9 text-sm" />
                      </Field>
                      <Field label="Produto / Serviço" hint="O que a empresa vende ou oferece. Usado diretamente no comportamento do agente.">
                        <Input value={config.persona.produto} onChange={(e) => setPersona('produto', e.target.value)} placeholder="Ex: roupas masculinas, consultoria de marketing, planos de saúde" className="h-9 text-sm" />
                      </Field>
                      <Field label="Tom de voz" hint="Como o agente deve se comunicar com os leads.">
                        <Input value={config.persona.tom} onChange={(e) => setPersona('tom', e.target.value)} placeholder="Ex: informal e consultivo, direto e descontraído" className="h-9 text-sm" />
                      </Field>
                      <Field label="Horário de atendimento" hint="Informado ao lead quando perguntar sobre disponibilidade." optional>
                        <Input value={config.persona.horario} onChange={(e) => setPersona('horario', e.target.value)} placeholder="Ex: Seg a Sex das 9h às 18h" className="h-9 text-sm" />
                      </Field>
                      <Field label="O que nunca dizer" hint="Restrições e comportamentos que o agente deve evitar." optional>
                        <Textarea value={config.persona.restricoes} onChange={(e) => setPersona('restricoes', e.target.value)} placeholder="Ex: não mencione preços sem entender a necessidade do cliente" className="min-h-[72px] text-sm resize-none" />
                      </Field>
                    </div>
                  )}

                  {/* ── Integrações ── */}
                  {activeTab === 'integracoes' && (
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">Google Calendar</p>
                          {!needsAgendamento && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">
                              Ative o tipo "Agendamento" na aba Geral
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">Calendário usado pelo agente para agendar reuniões automaticamente</p>
                        <div className={cn(!needsAgendamento && 'opacity-50 pointer-events-none')}>
                          <CalendarSection calendarId={config.google_calendar_id} onCalendarIdChange={(id) => setConfig((p) => ({ ...p, google_calendar_id: id }))} />
                        </div>
                      </div>
                      <div className={cn(!needsAgendamento && 'opacity-50 pointer-events-none')}>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">Título da reunião</p>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Nome do evento criado no Google Calendar. Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para incluir o nome do lead.</p>
                        <Input
                          placeholder="Ex: Call de vendas — {nome}"
                          value={config.event_title_template}
                          onChange={(e) => setConfig((p) => ({ ...p, event_title_template: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Cardápio ── */}
                  {activeTab === 'cardapio' && (
                    <div className="space-y-4">
                      <CatalogManager />
                    </div>
                  )}

                </div>
              </div>
            )
          })()}

          {/* ── Conhecimento — split panel ── */}
          {activeTab === 'conhecimento' && (
            <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[560px]">
              {/* Left — KB config */}
              <div className="w-[360px] shrink-0 overflow-y-auto pr-2 space-y-6 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-semibold">Base de conhecimento</p>
                  </div>
                  <KnowledgeBuilder
                    flowId={config.flow_id}
                    type="conhecimento"
                    active={config.conhecimento_ativo}
                    onActiveChange={(v) => setConfig((p) => ({ ...p, conhecimento_ativo: v }))}
                    persona={config.persona}
                    onPersonaChange={setPersona}
                    sharedNicheId={sharedNicheId}
                    onNicheChange={handleNicheChange}
                  />
                </div>
                <div className="border-t border-border/60 pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-semibold">Base de objeções</p>
                  </div>
                  <KnowledgeBuilder
                    flowId={config.flow_id}
                    type="objecoes"
                    active={config.objecoes_ativo}
                    onActiveChange={(v) => setConfig((p) => ({ ...p, objecoes_ativo: v }))}
                    persona={config.persona}
                    onPersonaChange={setPersona}
                    sharedNicheId={sharedNicheId}
                    onNicheChange={handleNicheChange}
                  />
                </div>
              </div>

              {/* Right — Simulator */}
              <div className="flex-1 min-w-0 rounded-xl border border-border overflow-hidden">
                <SimulatorChat
                  nicheId={sharedNicheId}
                  flowId={config.flow_id}
                  variables={simVariables}
                />
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
