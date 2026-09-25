'use client'

import { AutomationsNav } from '@/components/automacoes/AutomationsNav'

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
  Settings, Brain, Sparkles, ChevronDown,
  ChevronRight, ChevronLeft, ArrowRight, Plus, Trash2, X,
  ShoppingBag, Pencil, Send, RefreshCw,
  ThumbsUp, AlertTriangle, Star, ChevronUp, Trash,
  Mic, FileImage, FileText,
  Monitor, Wand2, Smile, Activity, Leaf, Stethoscope,
  Heart, BarChart2, ShoppingCart, GraduationCap,
  UtensilsCrossed, Shirt, Scissors, PawPrint, Dumbbell, Wrench,
  TrendingUp, Link2, Copy, Target,
  type LucideIcon,
} from 'lucide-react'
import { BotMessageSquareIcon } from '@/components/ui/bot-message-square'
import { CogIcon } from '@/components/ui/cog'
import { FlaskIcon } from '@/components/ui/flask'
import { BrainIcon } from '@/components/ui/brain'
import { SlidersHorizontalIcon } from '@/components/ui/sliders-horizontal'
import { FilePenLineIcon } from '@/components/ui/file-pen-line'
import { CalendarDaysIcon } from '@/components/ui/calendar-days'
import { NICHES, VAR_LABELS, type SdrVariables, type VariableKey } from '@/lib/sdr/templates'
import Link from 'next/link'
import { MetaWhatsAppConnect } from '@/components/sdr/MetaWhatsAppConnect'
import { AgentAssistant } from '@/components/sdr/AgentAssistant'
import { MetaAdsConnect } from '@/components/sdr/MetaAdsConnect'
import { SdrDiagnosticoWidget } from '@/components/ui/sdr-diagnostico-widget'
import { HorarioContent } from '@/components/configuracoes/HorarioContent'

// ── Niche icons ────────────────────────────────────────────────────────────

const NICHE_ICONS: Record<string, LucideIcon> = {
  'saas':            Monitor,
  'clinica-estetica': Wand2,
  'odontologia':     Smile,
  'psicologia':      Brain,
  'fisioterapia':    Activity,
  'nutricao':        Leaf,
  'clinica-medica':  Stethoscope,
  'consultoria':     BarChart2,
  'ecommerce':       ShoppingCart,
  'educacao':        GraduationCap,
  'restaurante':     UtensilsCrossed,
  'moda':            Shirt,
  'beleza':          Scissors,
  'petshop':         PawPrint,
  'academia':        Dumbbell,
  'generico':        Bot,
  'monte-o-seu':     Wrench,
}

function NicheIcon({ id, className }: { id: string; className?: string }) {
  const Icon = NICHE_ICONS[id] ?? Heart
  return <Icon className={className ?? 'w-4 h-4'} />
}

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
  whatsapp_provider: 'uazapi' | 'meta'
  meta_wa_phone_number_id: string | null
  meta_wa_waba_id: string | null
  meta_wa_token: string | null
  meta_ad_account_id: string | null
  meta_ad_account_name: string | null
  meta_pixel_id: string | null
  meta_pixel_token: string | null
  billing_recurring: boolean
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

type AnyIconHandle = { startAnimation: () => void; stopAnimation: () => void }
type AnyAnimIcon = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<AnyIconHandle>
>

const TABS = [
  { id: 'geral',        label: 'Geral',        icon: CogIcon as AnyAnimIcon,              desc: 'Ative o agente, tipo e modo de atendimento' },
  { id: 'identidade',   label: 'Identidade',   icon: FlaskIcon as AnyAnimIcon,            desc: 'Persona, tom de voz e restrições do agente' },
  { id: 'conhecimento', label: 'Conhecimento', icon: BrainIcon as AnyAnimIcon,            desc: 'Base de conhecimento e simulador de conversas' },
  { id: 'integracoes',  label: 'Integrações',  icon: SlidersHorizontalIcon as AnyAnimIcon, desc: 'Google Calendar e demais integrações' },
  { id: 'horarios',     label: 'Horários',     icon: CalendarDaysIcon as AnyAnimIcon,     desc: 'Dias e horários em que o agente atende' },
  { id: 'cardapio',     label: 'Cardápio',     icon: FilePenLineIcon as AnyAnimIcon,      desc: 'Produtos e itens para pedidos via WhatsApp' },
] as const
type TabId = typeof TABS[number]['id']

function TabButton({
  id, label, icon: Icon, isActive, showChevron, onClick,
}: {
  id: string; label: string; icon: AnyAnimIcon;
  isActive: boolean; showChevron: boolean; onClick: () => void;
}) {
  const iconRef = useRef<AnyIconHandle>(null)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => iconRef.current?.stopAnimation?.()}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      )}
    >
      <Icon ref={iconRef} size={16} className="shrink-0" />
      <span>{label}</span>
      {showChevron && <ChevronRight className="w-3 h-3 ml-auto opacity-40" />}
    </button>
  )
}

const TOM_OPTIONS = [
  { value: 'amigável e próximo', label: 'Amigável', desc: 'Próximo, descontraído, usa emojis com moderação' },
  { value: 'profissional e direto', label: 'Profissional', desc: 'Formal, objetivo, sem emojis' },
  { value: 'empático e acolhedor', label: 'Empático', desc: 'Caloroso, paciente, valida sentimentos' },
  { value: 'dinâmico e entusiasmado', label: 'Dinâmico', desc: 'Energético, animado, motivador' },
]

const _PLACEHOLDER = [
  {
    key: 'descricao_produto',
    question: 'Como você descreveria o que vende ou oferece?',
    hint: 'Seja específico : isso aparece quando o agente apresenta seu negócio ao cliente.',
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
    question: 'Como o cliente finaliza o pedido : pelo WhatsApp ou por um link?',
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

// ── Guias para gerar o texto no Claude ────────────────────────────────────────

const GUIA_CONHECIMENTO = `Você é um especialista em SDR e criação de system prompts para agentes de WhatsApp.

Abaixo estão as informações do meu negócio. Com base nelas, responda cada um dos 10 blocos com o máximo de detalhe e especificidade. Os scripts devem estar em linguagem natural de WhatsApp : curtos, diretos, sem markdown. Não seja genérico.

Meu negócio: [Nome da empresa]
Meu produto/serviço: [O que você vende]
Nome do agente: [Nome do agente]

────────────────────────────
BLOCO 1 : Identidade do Agente
Quem é o agente, qual o nome, empresa, função e tom de comunicação?
[Preencha aqui]

BLOCO 2 : Produto / Serviço
O que o agente vende? Inclua tudo: o que está incluído, preço, condições, links, diferenciais. Isso é contexto interno : o agente usa para raciocinar, não para citar diretamente.
[Preencha aqui]

BLOCO 3 : O que NÃO existe
O que o agente NUNCA deve mencionar, oferecer ou inventar? Liste funcionalidades, planos, descontos ou condições que não existem.
[Preencha aqui]

BLOCO 4 : Abordagem de Vendas
Como o agente deve abordar o lead? Vai na dor primeiro ou apresenta o produto direto? Inclua a estratégia, exemplos de perguntas de diagnóstico E pelo menos uma pergunta que amplifique o custo/impacto do problema antes de apresentar a solução (ex: "isso te custa quanto por mês em oportunidade perdida?") : nunca pule direto do diagnóstico pro pitch sem aprofundar a dor.
[Preencha aqui]

BLOCO 5 : Qualificação
Quais perguntas qualificam o lead? Em que ordem? Inclua também: orçamento disponível (mesmo que aproximado) e prazo/urgência pra resolver isso : não só segmento e decisor. O que descarta (sem verba, sem perfil, não é o decisor, sem prazo definido)?
[Preencha aqui]

BLOCO 6 : Próximo Passo
Qual a ação final? Quando acionar, como apresentar, qual o link e o que fazer se o lead recusar?
[Preencha aqui]

BLOCO 7 : Lead Sem Perfil
Quando o lead não tem perfil, como encerrar com elegância? Inclua scripts para cada situação de descarte.
[Preencha aqui]

BLOCO 8 : Preços e Condições
Como funciona o investimento? O que revelar, quando e como? Há parcelamento, desconto ou teste grátis?
[Preencha aqui]

BLOCO 9 : Como o Lead Chega
De onde vêm os leads (anúncio, indicação, orgânico)? O que costumam dizer na primeira mensagem?
[Preencha aqui]

BLOCO 10 : Regras Absolutas
Quais são as regras que o agente NUNCA pode quebrar? Seja específico : cada regra deve ser clara e inviolável. Inclua obrigatoriamente estas três, além das específicas do seu negócio: (1) nunca se apresentar de novo depois da primeira mensagem da conversa; (2) nunca repetir uma pergunta de qualificação já respondida antes na mesma conversa; (3) nunca repetir o mesmo argumento ou diferencial mais de uma vez : sempre amarrar a resposta ao que o lead acabou de dizer, nunca reciclar bloco de pitch genérico.
[Preencha aqui]
────────────────────────────

Gere cada bloco com o nível de qualidade de um prompt de produção profissional. Scripts devem estar prontos para uso no WhatsApp.`

const GUIA_OBJECOES = `Você é um especialista em SDR e criação de scripts de objeções para WhatsApp.

Abaixo estão as informações do meu negócio. Com base nelas, responda cada um dos 3 blocos com respostas reais e específicas. Para cada objeção: informe os gatilhos (frases que o lead diz), o que está por trás da objeção (a preocupação real, não a frase literal), um exemplo de resposta que o agente deve ADAPTAR ao que o lead disse (nunca copiar igual pra todo mundo) e o que nunca dizer.

Dado real de vendas (Gong, análise de 67 mil ligações): reps que pausam e fazem uma pergunta de esclarecimento antes de rebater vencem mais do que quem dispara resposta decorada. Script fixo copiado igual pra todo lead é a causa mais comum de "isso parece bot" : não escreva frase pra decorar, escreva a lógica de resposta com um exemplo.

Meu negócio: [Nome da empresa]
Meu produto/serviço: [O que você vende]
Preço: [Valor e condições de pagamento]
Concorrentes diretos (nomeie, se souber): [Nome dos concorrentes]
Prova social real (número de clientes, case, depoimento, garantia): [Preencha aqui]

────────────────────────────
BLOCO 1 : Objeções de Preço e Valor
Para cada objeção de preço, informe: gatilhos → o que está por trás → exemplo de resposta (adaptável) → o que nunca dizer → condicional (se houver).
Inclua pelo menos: "Tá caro", "Não tenho dinheiro agora", "Vou pensar", "Não sei se vale a pena".
[Preencha aqui]

BLOCO 2 : Objeções de Tempo, Indecisão, Concorrência e Confiança
Para cada objeção, informe: gatilhos → o que está por trás → exemplo de resposta (adaptável) → condicional (se houver).
Inclua pelo menos: "Não tenho tempo", "Preciso pensar", "Já uso outro", "Vou esperar", "Isso é golpe?", "Vocês são confiáveis?" (comum em venda fria por WhatsApp de empresa desconhecida, não pule essa).
[Preencha aqui]

BLOCO 3 : Dúvidas sobre o Produto
Para cada dúvida frequente, informe: gatilho → resposta direta e específica.
Inclua as perguntas mais comuns que seus leads fazem sobre o produto/serviço.
[Preencha aqui]
────────────────────────────

Respostas devem ser curtas (máximo 3 linhas), em linguagem natural de WhatsApp, sem markdown, sem emojis em excesso.`

function DicaDeOuro() {
  type Handle = { startAnimation: () => void; stopAnimation: () => void }
  const iconRef = useRef<Handle>(null)
  const [copiedConhecimento, setCopiedConhecimento] = useState(false)
  const [copiedObjecoes, setCopiedObjecoes] = useState(false)

  useEffect(() => {
    const start = () => iconRef.current?.startAnimation?.()
    start()
    const interval = setInterval(start, 3000)
    return () => clearInterval(interval)
  }, [])

  function copy(text: string, type: 'conhecimento' | 'objecoes') {
    navigator.clipboard.writeText(text)
    if (type === 'conhecimento') {
      setCopiedConhecimento(true)
      setTimeout(() => setCopiedConhecimento(false), 2000)
    } else {
      setCopiedObjecoes(true)
      setTimeout(() => setCopiedObjecoes(false), 2000)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-4">
      <div className="flex items-center gap-2.5">
        <BotMessageSquareIcon ref={iconRef} size={16} className="text-amber-500 shrink-0" />
        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Dica de Ouro</p>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Antes de preencher o formulário, use o Claude para gerar respostas detalhadas para cada bloco. Copie o modelo, substitua os campos <span className="font-mono bg-muted px-1 rounded text-[10px]">[entre colchetes]</span> com as informações do seu negócio, cole no Claude e peça para gerar. Depois volte e preencha etapa por etapa.
      </p>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => copy(GUIA_CONHECIMENTO, 'conhecimento')}
          className="w-full h-9 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted/50 px-3 text-xs font-medium transition-colors"
        >
          {copiedConhecimento ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          {copiedConhecimento ? 'Copiado!' : 'Copiar guia : Conhecimento'}
        </button>
        <button
          onClick={() => copy(GUIA_OBJECOES, 'objecoes')}
          className="w-full h-9 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background hover:bg-muted/50 px-3 text-xs font-medium transition-colors"
        >
          {copiedObjecoes ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          {copiedObjecoes ? 'Copiado!' : 'Copiar guia : Objeções'}
        </button>
      </div>
    </div>
  )
}

// ── Knowledge Builder ──────────────────────────────────────────────────────

function buildSdrVariables(persona: AgentPersona): SdrVariables {
  return {
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
  }
}

interface ExistingBase { filename: string; chunks: number }

function KnowledgeBuilder({ flowId, type, active, onActiveChange, persona, onPersonaChange, sharedNicheId, onNicheChange, onOpenAssistant, refreshKey }: {
  flowId: string | null; type: 'conhecimento' | 'objecoes'
  active: boolean; onActiveChange: (v: boolean) => void
  persona: AgentPersona
  onPersonaChange: (field: keyof AgentPersona, value: string) => void
  sharedNicheId: string
  onNicheChange: (id: string) => void
  /** abre o assistente de criação (cria as duas bases de uma vez) */
  onOpenAssistant: () => void
  /** muda quando o assistente termina, para recarregar o status da base */
  refreshKey: number
}) {
  const [existingBase, setExistingBase] = useState<ExistingBase | null>(null)

  const isConhecimento = type === 'conhecimento'
  const label = isConhecimento ? 'conhecimento' : 'objeções'
  const Icon = isConhecimento ? BookOpen : ShieldAlert

  useEffect(() => {
    if (!flowId || !active) return
    const url = isConhecimento
      ? `/api/sdr/flows/${flowId}/knowledge`
      : `/api/sdr/flows/${flowId}/objections`
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.exists) setExistingBase({ filename: d.filename, chunks: d.chunks }) })
      .catch(() => {})
  }, [flowId, active, isConhecimento, refreshKey])

  return (
    <>
      {/* Status card */}
      <div className="rounded-xl border border-border p-3.5 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-sm font-medium capitalize">Base de {label}</p>
          </div>
          <Switch checked={active} onCheckedChange={onActiveChange} />
        </div>

        {active && (
          <>
            {/* Status indicator */}
            {existingBase ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/8 border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">Configurada</p>
                  <p className="text-[11px] text-muted-foreground">{existingBase.chunks} chunks salvos</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {isConhecimento
                    ? 'Sem base : o agente pode alucinar em perguntas sobre o negócio'
                    : 'Sem base : o agente não saberá tratar objeções de preço ou indecisão'}
                </p>
              </div>
            )}

            {/* Action button */}
            <Button
              size="sm"
              variant={existingBase ? 'outline' : 'default'}
              className="w-full h-8 text-xs gap-1.5"
              onClick={onOpenAssistant}
            >
              {existingBase
                ? <><Pencil className="w-3 h-3" />Editar base de {label}</>
                : <><Sparkles className="w-3 h-3" />Configurar base de {label}</>}
            </Button>
          </>
        )}
      </div>
    </>
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

// ── Google Ads (OAuth + status) ───────────────────────────────────────────

interface GoogleAdsStatus { connected: boolean; email: string | null; customer_id: string | null }

function GoogleAdsSection() {
  const [status, setStatus] = useState<GoogleAdsStatus>({ connected: false, email: null, customer_id: null })
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/google-ads/status').then((r) => r.json())
      .then((d) => setStatus({ connected: d.connected, email: d.email, customer_id: d.customer_id }))
      .catch(() => {})
  }, [])

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/google-ads/status', { method: 'DELETE' })
      setStatus({ connected: false, email: null, customer_id: null })
    } finally { setDisconnecting(false) }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-sm font-semibold">Google Ads : Enhanced Conversions</p>
        {status.connected && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium ml-auto">Conectado</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Conecta a conta Google Ads pra casar leads fechados com cliques via telefone (Enhanced Conversions for Leads). Upload automático da conversão ainda depende de aprovação do Developer Token pela Google.
      </p>
      {status.connected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <span className="font-mono text-foreground truncate">{status.email}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={disconnect} disabled={disconnecting} className="text-xs text-muted-foreground gap-1.5 h-7 shrink-0">
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}Desconectar
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => { window.location.href = '/api/google-ads/auth' }} className="gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Conectar com Google Ads
        </Button>
      )}
    </div>
  )
}

// ── Links Rastreados (captura de gclid pra Google Ads) ────────────────────

interface TrackingLink {
  id: number; slug: string; phone: string; mensagem: string | null
  utm_campaign: string | null; utm_source: string | null; gclid_capture: boolean; cliques: number
}

function TrackingLinksManager() {
  const [links, setLinks] = useState<TrackingLink[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ phone: '', mensagem: '', utm_campaign: '', utm_source: '', gclid_capture: true })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/sdr/tracking-links')
      const data = await res.json()
      setLinks(data.links ?? [])
    } catch { toast({ title: 'Erro ao carregar links', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  async function createLink() {
    if (!form.phone || (!form.utm_campaign && !form.utm_source)) {
      toast({ title: 'Telefone e campanha/fonte são obrigatórios', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/sdr/tracking-links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLinks((p) => [data.link, ...p])
      setForm({ phone: '', mensagem: '', utm_campaign: '', utm_source: '', gclid_capture: true })
      setAdding(false)
    } catch (err: any) { toast({ title: `Erro: ${err.message}`, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  async function deleteLink(id: number) {
    setLinks((p) => p.filter((l) => l.id !== id))
    await fetch(`/api/sdr/tracking-links?id=${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function linkUrl(link: TrackingLink) {
    const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    return link.gclid_capture ? `${base}/l/${link.slug}?gclid={gclid}` : `${base}/api/track/${link.slug}`
  }

  function copyUrl(link: TrackingLink) {
    navigator.clipboard.writeText(linkUrl(link)).then(() => toast({ title: 'Link copiado' }))
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-sm font-semibold">Links Rastreados</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Gere um link pra usar no anúncio do Google. Com "capturar gclid" ativo, o link abre uma página pedindo o telefone antes de ir pro WhatsApp — necessário pra Enhanced Conversions.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando…</div>
      ) : (
        <div className="space-y-2 mb-3">
          {links.map((link) => (
            <div key={link.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{link.utm_campaign || link.utm_source}{link.gclid_capture && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600">gclid</span>}</p>
                <p className="text-[10px] text-muted-foreground truncate">{linkUrl(link)} · {link.cliques} cliques</p>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyUrl(link)}><Copy className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive" onClick={() => deleteLink(link.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          {links.length === 0 && <p className="text-xs text-muted-foreground py-1">Nenhum link criado ainda.</p>}
        </div>
      )}

      {adding ? (
        <div className="space-y-2 p-3 rounded-lg border border-border">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Telefone (WhatsApp destino)" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="h-8 text-sm" />
            <Input placeholder="Campanha (utm_campaign)" value={form.utm_campaign} onChange={(e) => setForm((p) => ({ ...p, utm_campaign: e.target.value }))} className="h-8 text-sm" />
          </div>
          <Input placeholder="Mensagem pré-preenchida (opcional)" value={form.mensagem} onChange={(e) => setForm((p) => ({ ...p, mensagem: e.target.value }))} className="h-8 text-sm" />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={form.gclid_capture} onCheckedChange={(v) => setForm((p) => ({ ...p, gclid_capture: v }))} />
            Capturar telefone + gclid antes de redirecionar (recomendado pra Google Ads)
          </label>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" disabled={saving} onClick={createLink}>
              {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Criar link
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5" />Novo link
        </Button>
      )}
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
        Cadastre os itens do cardápio. O agente usa a lista para identificar pedidos por número : ex: "quero o item 30".
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
type LeadPersona = 'default' | 'cold' | 'price' | 'urgent' | 'indecisive' | 'closing'
interface SimMessage { role: 'user' | 'assistant'; content: string }
interface SimFeedback { score: number; positivo: string; melhorar: string | null }
interface SimAlert { type: string; message: string; severity: 'warning' | 'critical' }
interface SimTurn { userMsg: string; sdrMsgs: string[]; feedback: SimFeedback; alert?: SimAlert | null; ts: string; isAuto?: boolean }

const LEAD_PERSONAS: Record<LeadPersona, { label: string; emoji: string; hint: string }> = {
  default:    { label: 'Livre',            emoji: '💬', hint: 'Digite como quiser : você controla' },
  cold:       { label: 'Lead Frio',        emoji: '🧊', hint: 'Seja cético, sem urgência, curioso mas desconfiado' },
  price:      { label: 'Objeção de Preço', emoji: '💰', hint: 'Pergunte o preço logo de cara, compare com concorrentes' },
  urgent:     { label: 'Lead Urgente',     emoji: '⚡', hint: 'Você precisa resolver hoje : seja direto e impaciente' },
  indecisive: { label: 'Indeciso',         emoji: '🤔', hint: 'Use "vou pensar", "não sei ainda", peça garantias' },
  closing:    { label: 'Quase Fechando',   emoji: '🎯', hint: 'Você já quer : só falta confirmar detalhes finais' },
}

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

function QuickOnboarding({ onComplete }: {
  onComplete: (data: { persona: AgentPersona; nicheId: string }) => void
}) {
  const [step, setStep] = useState(0)
  const [nicheId, setNicheId] = useState('')
  const [nome_agente, setNomeAgente] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [tom, setTom] = useState('')
  const [produto, setProduto] = useState('')
  const [preco, setPreco] = useState('')
  const [horario, setHorario] = useState('')
  const [endereco, setEndereco] = useState('')
  const [link_agendamento, setLinkAgendamento] = useState('')

  const steps = [
    { title: 'Qual o nicho do seu negócio?', desc: 'Isso define o comportamento do agente' },
    { title: 'Quem é o agente?', desc: 'Nome do agente e da sua empresa' },
    { title: 'Qual o tom de voz?', desc: 'Como o agente se comunica com os clientes' },
    { title: 'O que você oferece?', desc: 'Produto, serviço e preços' },
    { title: 'Onde e quando?', desc: 'Localização, horários e link de agendamento' },
  ]

  const canAdvance = [
    !!nicheId,
    !!nome_agente && !!empresa,
    !!tom,
    !!produto,
    !!horario,
  ][step] ?? false

  function finish() {
    const selectedNiche = NICHES.find((n) => n.id === nicheId)
    onComplete({
      nicheId,
      persona: {
        ...EMPTY_PERSONA,
        nome_agente, empresa, tom,
        produto: produto || selectedNiche?.label || '',
        preco, horario, endereco, link_agendamento,
        nicho_id: nicheId,
      },
    })
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {steps.map((_, i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground mb-1">Passo {step + 1} de {steps.length}</p>
      <h2 className="text-xl font-bold mb-1">{steps[step].title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{steps[step].desc}</p>

      {/* Step 0 : Nicho */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {NICHES.filter((n) => n.id !== 'monte-o-seu').map((n) => (
            <button key={n.id} type="button" onClick={() => setNicheId(n.id)}
              className={cn('text-left p-3 rounded-xl border transition-all',
                nicheId === n.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40')}>
              <NicheIcon id={n.id} className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium mt-1">{n.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{n.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 1 : Agente + empresa */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome do agente</label>
            <Input value={nome_agente} onChange={(e) => setNomeAgente(e.target.value)} placeholder="Ex: Ana, Carlos, Maya…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome da empresa</label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Ex: Clínica Bella, Studio Fit…" />
          </div>
        </div>
      )}

      {/* Step 2 : Tom */}
      {step === 2 && (
        <div className="grid grid-cols-2 gap-2">
          {TOM_OPTIONS.map((t) => (
            <button key={t.value} type="button" onClick={() => setTom(t.value)}
              className={cn('text-left p-3 rounded-xl border transition-all',
                tom === t.value ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40')}>
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 3 : Produto + Preço */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descreva o que você oferece</label>
            <Textarea value={produto} onChange={(e) => setProduto(e.target.value)} rows={3}
              placeholder="Ex: Consulta de nutrição presencial e online, com plano alimentar personalizado…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Preços e condições (opcional)</label>
            <Textarea value={preco} onChange={(e) => setPreco(e.target.value)} rows={2}
              placeholder="Ex: Consulta R$180, pacote com 3 sessões R$480. Pagamento no PIX ou cartão." />
          </div>
        </div>
      )}

      {/* Step 4 : Localização + horário */}
      {step === 4 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Horário de atendimento</label>
            <Input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Ex: Segunda a sexta das 8h às 18h" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Endereço (opcional)</label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Ex: Rua das Flores, 123 : São Paulo/SP" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Link de agendamento (opcional)</label>
            <Input value={link_agendamento} onChange={(e) => setLinkAgendamento(e.target.value)} placeholder="https://calendly.com/…" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 mt-8">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance} className="flex-1 gap-1.5">
            Continuar <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={!canAdvance} className="flex-1 gap-1.5">
            <Sparkles className="w-4 h-4" /> Criar agente
          </Button>
        )}
      </div>
    </div>
  )
}

function AlertBanner({ alert, onDismiss }: { alert: SimAlert; onDismiss: () => void }) {
  return (
    <div className={cn(
      'mx-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs animate-in slide-in-from-bottom-2 duration-300',
      alert.severity === 'critical'
        ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
        : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
    )}>
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span className="flex-1 font-medium leading-snug">{alert.message}</span>
      <button type="button" onClick={onDismiss} className="opacity-50 hover:opacity-100 transition-opacity mt-0.5">
        <X className="w-3 h-3" />
      </button>
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
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null)
  const [applyingIndex, setApplyingIndex] = useState<number | null>(null)
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<SimMode>('inbound')
  const [persona, setPersona] = useState<LeadPersona>('default')
  const [personaOpen, setPersonaOpen] = useState(false)
  const [activeAlert, setActiveAlert] = useState<SimAlert | null>(null)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoPersona, setAutoPersona] = useState<LeadPersona>('cold')
  const [autoRounds, setAutoRounds] = useState(4)
  const [showAutoPanel, setShowAutoPanel] = useState(false)
  const [autoSummary, setAutoSummary] = useState<{ avgScore: number; wouldConvert: boolean; errors: string[]; rounds: number } | null>(null)
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
    setPendingUserMsg(msg)
    try {
      const res = await fetch('/api/sdr/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicheId, variables, history, userMessage: msg, mode, flowId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao simular')
      saveTurns([...turns, { userMsg: msg, sdrMsgs: data.sdrMessages ?? [data.sdrResponse ?? '...'], feedback: data.feedback, alert: data.alert ?? null, ts: now() }])
      if (data.alert) setActiveAlert(data.alert)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setPendingUserMsg(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function applyCorrection(index: number) {
    const turn = turns[index]
    if (!turn?.feedback.melhorar || applyingIndex !== null || !flowId) return
    setApplyingIndex(index)
    try {
      // 1. Save correction to KB
      const patchRes = await fetch(`/api/sdr/flows/${flowId}/knowledge/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correction: turn.feedback.melhorar,
          type: 'conhecimento',
          userMsg: turn.userMsg,
          sdrMsg: turn.sdrMsgs.filter((m) => parseSdrMsg(m).type === 'text').join('\n'),
        }),
      })
      const patchData = await patchRes.json()
      if (!patchRes.ok) throw new Error(patchData.error || 'Erro ao salvar correção')

      // 2. Regenerate this turn with correction applied
      const historyUpToHere: SimMessage[] = turns.slice(0, index).flatMap((t) => [
        { role: 'user' as const, content: t.userMsg },
        { role: 'assistant' as const, content: t.sdrMsgs.filter((m) => !parseSdrMsg(m).type.match(/image|audio|doc/)).join('\n') },
      ])
      const regenRes = await fetch('/api/sdr/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicheId, variables, flowId, mode,
          history: historyUpToHere,
          userMessage: turn.userMsg,
          correctionHint: turn.feedback.melhorar,
        }),
      })
      const regenData = await regenRes.json()
      if (regenRes.ok && regenData.sdrMessages?.length) {
        saveTurns(turns.map((t, i) =>
          i === index ? { ...t, sdrMsgs: regenData.sdrMessages, feedback: regenData.feedback } : t
        ))
      }

      setAppliedIndices((prev) => new Set(prev).add(index))
      toast({ title: '✓ Correção aplicada : resposta regenerada' })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao aplicar correção', variant: 'destructive' })
    } finally { setApplyingIndex(null) }
  }

  async function runAutoSim() {
    if (!nicheId || autoRunning) return
    setAutoRunning(true)
    setShowAutoPanel(false)
    setAutoSummary(null)
    saveTurns([])
    setActiveAlert(null)

    let currentTurns: SimTurn[] = []

    const addOrUpdateTurn = (updater: (prev: SimTurn[]) => SimTurn[]) => {
      currentTurns = updater(currentTurns)
      saveTurns(currentTurns)
    }

    try {
      const res = await fetch('/api/sdr/auto-simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicheId, variables, flowId, mode, persona: autoPersona, rounds: autoRounds }),
      })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro na simulação automática')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            if (event.type === 'lead') {
              addOrUpdateTurn((prev) => [...prev, {
                userMsg: event.message,
                sdrMsgs: [],
                feedback: { score: 0, positivo: '', melhorar: null },
                ts,
                isAuto: true,
              }])
              setLoading(true)
            } else if (event.type === 'sdr') {
              setLoading(false)
              addOrUpdateTurn((prev) => prev.map((t, i) =>
                i === prev.length - 1 ? { ...t, sdrMsgs: event.messages } : t
              ))
            } else if (event.type === 'feedback') {
              addOrUpdateTurn((prev) => prev.map((t, i) =>
                i === prev.length - 1 ? { ...t, feedback: event.feedback } : t
              ))
            } else if (event.type === 'summary') {
              setAutoSummary(event.summary)
            } else if (event.type === 'error') {
              throw new Error(event.message)
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr
          }
        }
      }
    } catch (err: any) {
      toast({ title: err.message || 'Erro na simulação automática', variant: 'destructive' })
    } finally {
      setAutoRunning(false)
      setLoading(false)
    }
  }

  async function applyAutoError(error: string) {
    if (!flowId) return
    try {
      await fetch(`/api/sdr/flows/${flowId}/knowledge/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correction: error, type: 'conhecimento' }),
      })
      toast({ title: 'Correção salva na base de conhecimento' })
    } catch {
      toast({ title: 'Erro ao salvar correção', variant: 'destructive' })
    }
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
          {/* Auto-sim button */}
          <button
            type="button"
            onClick={() => setShowAutoPanel((v) => !v)}
            title="Simulação automática"
            className={cn(
              'p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1',
              showAutoPanel ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          {turns.length > 0 && (
            <>
              <button type="button" onClick={clearHistory} title="Apagar histórico"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <Trash className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => { saveTurns([]); setError(null); setAutoSummary(null) }} title="Novo chat"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Auto-sim panel ── */}
      {showAutoPanel && (
        <div className="border-b border-border/60 bg-muted/20 px-4 py-3 space-y-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Simulação Automática : IA joga o lead
          </p>
          <div className="flex gap-2 flex-wrap">
            {(Object.entries(LEAD_PERSONAS) as [LeadPersona, typeof LEAD_PERSONAS.default][])
              .filter(([k]) => k !== 'default')
              .map(([key, p]) => (
                <button key={key} type="button" onClick={() => setAutoPersona(key as LeadPersona)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1',
                    autoPersona === key ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  )}>
                  {p.emoji} {p.label}
                </button>
              ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rodadas:</span>
              {[3, 4, 5, 6].map((n) => (
                <button key={n} type="button" onClick={() => setAutoRounds(n)}
                  className={cn('w-7 h-7 rounded-lg border text-xs font-medium transition-colors',
                    autoRounds === n ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
                  {n}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={runAutoSim} disabled={autoRunning} className="ml-auto h-8 gap-1.5 text-xs">
              {autoRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {autoRunning ? 'Simulando…' : 'Iniciar'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 min-h-0" style={{ background: 'var(--sim-bg, hsl(var(--muted)/0.3))' }}>
        {turns.length === 0 && !autoRunning && (
          <div className="flex flex-col items-center gap-2 pt-8 text-center">
            <div className="px-3 py-1.5 rounded-full bg-muted/60 text-[11px] text-muted-foreground/70 border border-border/40">
              Simulação iniciada · {niche?.label}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1">Digite como um lead chegando pelo WhatsApp</p>
          </div>
        )}
        {autoRunning && turns.length === 0 && (
          <div className="flex flex-col items-center gap-3 pt-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">IA iniciando conversa como {LEAD_PERSONAS[autoPersona].emoji} {LEAD_PERSONAS[autoPersona].label}…</p>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-1">
            {/* Lead message : right */}
            <div className="flex justify-end">
              <div className="max-w-[75%]">
                <div className="rounded-2xl rounded-tr-none bg-emerald-600 text-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">
                  {turn.userMsg}
                </div>
                <p className="text-[10px] text-muted-foreground/50 text-right mt-0.5 pr-1">{turn.ts}</p>
              </div>
            </div>

            {/* SDR messages : left, one bubble per message */}
            <div className="flex items-end gap-2">
              <div className={cn(
                "w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-4",
                applyingIndex === i && "animate-pulse"
              )}>
                <Bot className="w-3 h-3 text-primary" />
              </div>
              <div className={cn("max-w-[75%] space-y-1 transition-opacity duration-300", applyingIndex === i && "opacity-50")}>
                {applyingIndex === i ? (
                  <div className="rounded-2xl rounded-tl-none bg-card border border-border/60 px-3 py-2 shadow-sm">
                    <TypingDots />
                  </div>
                ) : turn.sdrMsgs.map((msg, j) => (
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

        {pendingUserMsg && (
          <div className="flex justify-end">
            <div className="max-w-[75%]">
              <div className="rounded-2xl rounded-tr-none bg-emerald-600 text-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">
                {pendingUserMsg}
              </div>
            </div>
          </div>
        )}

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

        {autoSummary && (
          <div className="mx-3 rounded-xl border border-border bg-card p-4 space-y-2 animate-in fade-in duration-300">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Resultado da Simulação Automática
            </p>
            <div className="flex items-center gap-3">
              <div className={cn('text-2xl font-bold', autoSummary.avgScore >= 7 ? 'text-emerald-500' : autoSummary.avgScore >= 5 ? 'text-amber-500' : 'text-red-500')}>
                {autoSummary.avgScore}/10
              </div>
              <div className="flex-1">
                <p className={cn('text-xs font-medium', autoSummary.wouldConvert ? 'text-emerald-600' : 'text-red-600')}>
                  {autoSummary.wouldConvert ? '✓ Converteria esse lead' : '✗ Esse lead não converteria'}
                </p>
                <p className="text-[11px] text-muted-foreground">{autoSummary.rounds} trocas simuladas</p>
              </div>
            </div>
            {autoSummary.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">Erros identificados:</p>
                {autoSummary.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2.5 py-2">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 flex-1">{e}</p>
                    {flowId && (
                      <button
                        type="button"
                        onClick={() => applyAutoError(e)}
                        className="shrink-0 text-[10px] font-medium text-primary hover:underline"
                      >
                        Aplicar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Alert banner ── */}
      {activeAlert && (
        <div className="px-0 pt-2">
          <AlertBanner alert={activeAlert} onDismiss={() => setActiveAlert(null)} />
        </div>
      )}

      {/* ── Mode toggle + Input ── */}
      <div className="border-t border-border/60 bg-card shrink-0">
        {/* Inbound / Outbound / Persona row */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1 flex-wrap gap-y-1">
          <span className="text-[10px] text-muted-foreground/60 mr-1">Modo:</span>
          {(['inbound', 'outbound'] as SimMode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                mode === m ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground')}>
              {m === 'inbound' ? 'Inbound' : 'Outbound'}
            </button>
          ))}
          <div className="relative ml-auto">
            <button type="button" onClick={() => setPersonaOpen((v) => !v)}
              className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-colors flex items-center gap-1',
                persona !== 'default' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground/60 hover:border-border hover:text-muted-foreground')}>
              {LEAD_PERSONAS[persona].emoji} {LEAD_PERSONAS[persona].label} <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {personaOpen && (
              <div className="absolute bottom-full right-0 mb-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10 min-w-[180px]">
                {(Object.entries(LEAD_PERSONAS) as [LeadPersona, typeof LEAD_PERSONAS.default][]).map(([key, p]) => (
                  <button key={key} type="button"
                    onClick={() => { setPersona(key as LeadPersona); setPersonaOpen(false) }}
                    className={cn('w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors',
                      persona === key ? 'text-primary bg-primary/5' : 'text-foreground')}>
                    <span className="text-sm leading-none mt-0.5">{p.emoji}</span>
                    <div>
                      <p className="font-medium">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.hint}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {persona !== 'default' && (
          <div className="mx-3 mb-1 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/10 text-[10px] text-primary/80">
            {LEAD_PERSONAS[persona].hint}
          </div>
        )}

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
  const [setupMode, setSetupMode] = useState<'choosing' | 'quick' | 'advanced'>('advanced')
  const [config, setConfig] = useState<SdrConfig>({
    agent_type: 'atendimento_venda',
    persona: { ...EMPTY_PERSONA },
    agente_ativo: false, webhook_url: null,
    instance_status: 'disconnected', instance_phone: null,
    vector_table_conhecimento: '', vector_table_objecoes: '',
    conhecimento_ativo: true, objecoes_ativo: false,
    google_calendar_id: '', flow_id: null, inbox_mode: 'suporte',
    event_title_template: '',
    whatsapp_provider: 'uazapi',
    meta_wa_phone_number_id: null, meta_wa_waba_id: null, meta_wa_token: null,
    meta_ad_account_id: null, meta_ad_account_name: null,
    meta_pixel_id: null, meta_pixel_token: null,
    billing_recurring: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Assistente de criação do agente (9 passos)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [kbRefresh, setKbRefresh] = useState(0)
  const [hasExistingBase, setHasExistingBase] = useState(false)

  // Shared niche selection across KnowledgeBuilders
  const [sharedNicheId, setSharedNicheId] = useState('')
  const [identNicheOpen, setIdentNicheOpen] = useState(false)

  const [pixelDraft, setPixelDraft] = useState({ id: '', token: '' })
  const [savingPixel, setSavingPixel] = useState(false)

  // Só leitura : a Zaia checa payment_integrations a cada mensagem pra saber
  // se pode oferecer a tool Gerar_cobranca. A ativação em si (token) fica em
  // /configuracoes -> Integrações, aqui é só pra confirmar que ela enxerga.
  const [asaasStatus, setAsaasStatus] = useState<'loading' | 'active' | 'inactive'>('loading')

  // ── Validator state ────────────────────────────────────────────────────────
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    score: number
    ready: boolean
    covered: string[]
    gaps: Array<{
      id: string; scenario: string; severity: 'critica' | 'alta' | 'media'
      what_fails: string
      source: 'Base de Conhecimento' | 'Base de Objeções' | 'Identidade do Agente'
      example: string
      tab_wizard: 'identidade' | 'conhecimento' | 'integracoes' | 'geral'
      suggestion: string
    }>
    error?: string
  } | null>(null)
  const [showValidationModal, setShowValidationModal] = useState(false)

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
          whatsapp_provider: data.config.whatsapp_provider ?? 'uazapi',
          meta_wa_phone_number_id: data.config.meta_wa_phone_number_id ?? null,
          meta_wa_waba_id: data.config.meta_wa_waba_id ?? null,
          meta_wa_token: data.config.meta_wa_token ?? null,
          meta_ad_account_id: data.config.meta_ad_account_id ?? null,
          meta_ad_account_name: data.config.meta_ad_account_name ?? null,
          meta_pixel_id: data.config.meta_pixel_id ?? null,
          meta_pixel_token: data.config.meta_pixel_token ?? null,
          billing_recurring: data.config.billing_recurring ?? false,
        })
        if (persona.nicho_id) setSharedNicheId(persona.nicho_id)
        if (!data.config.flow_id) setSetupMode('choosing')
      }
    } catch { toast({ title: 'Erro ao carregar configuração', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  // Abre direto numa aba quando o endereço traz ?tab= (ex.: vindo dos Templates para conectar a API oficial)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && TABS.some((x) => x.id === t)) setActiveTab(t as TabId)
  }, [])

  useEffect(() => {
    fetch('/api/payment-integrations')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const active = (d?.integrations ?? []).some((i: any) => i.platform === 'asaas' && i.active)
        setAsaasStatus(active ? 'active' : 'inactive')
      })
      .catch(() => setAsaasStatus('inactive'))
  }, [])

  const setPersona = (field: keyof AgentPersona, value: string) =>
    setConfig((prev) => ({ ...prev, persona: { ...prev.persona, [field]: value } }))

  function handleNicheChange(id: string) {
    setSharedNicheId(id)
    setPersona('nicho_id', id)
    const niche = NICHES.find((n) => n.id === id)
    if (niche) setPersona('produto', niche.label)
  }

  const handleDiagnosticar = async () => {
    setValidating(true)
    try {
      const res = await fetch('/api/sdr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: { ...config.persona, nicho_id: sharedNicheId },
          agent_type: config.agent_type,
          conhecimento_ativo: config.conhecimento_ativo,
          objecoes_ativo: config.objecoes_ativo,
        }),
      })
      const data = await res.json()
      if (data.code === 'SEM_BASE') {
        toast({
          title: 'Base de conhecimento vazia',
          description: 'Configure a Base de Conhecimento na aba Conhecimento antes de diagnosticar.',
        })
        setActiveTab('conhecimento')
        return
      }
      if (data.error) throw new Error(data.error)
      // garante que gaps e covered sempre existem
      setValidationResult({ score: 0, ready: false, covered: [], gaps: [], ...data })
      setShowValidationModal(true)
    } catch (err: any) {
      toast({ title: 'Erro na análise', description: err?.message ?? 'Não foi possível analisar o SDR.', variant: 'destructive' })
    } finally {
      setValidating(false)
    }
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
          billing_recurring: config.billing_recurring,
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

  // A criação termina no servidor; a página guarda o nome do agente com o mesmo salvar de sempre
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  // Ao abrir o assistente, confere se já existe base (criar de novo substitui a atual)
  useEffect(() => {
    if (!assistantOpen || !config.flow_id) return
    Promise.all([
      fetch(`/api/sdr/flows/${config.flow_id}/knowledge`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/sdr/flows/${config.flow_id}/objections`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([k, o]) => setHasExistingBase(!!(k?.exists || o?.exists)))
  }, [assistantOpen, config.flow_id])

  const handleSavePixel = async () => {
    setSavingPixel(true)
    try {
      const res = await fetch('/api/sdr/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meta_pixel_id: pixelDraft.id, meta_pixel_token: pixelDraft.token }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setConfig((p) => ({ ...p, meta_pixel_id: pixelDraft.id || null, meta_pixel_token: pixelDraft.token || null }))
      setPixelDraft({ id: '', token: '' })
      toast({ title: 'Pixel configurado!' })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar pixel', variant: 'destructive' })
    } finally { setSavingPixel(false) }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.zaapply.com.br'

  const isConnected = config.instance_status === 'connected'
  const isConnecting = config.instance_status === 'connecting'
  const needsAgendamento = config.agent_type === 'atendimento_venda_agendamento'

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>

  // ── Choosing mode ──────────────────────────────────────────────────────
  if (setupMode === 'choosing') {
    return (
      <div className="max-w-2xl mx-auto p-6 pb-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Agente SDR</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Como você quer configurar seu agente?</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => setSetupMode('quick')}
            className="text-left p-5 rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <p className="font-semibold text-sm">Configuração rápida</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Responda 5 perguntas simples e o agente fica pronto em minutos.</p>
            <p className="text-[11px] text-primary font-medium mt-3">Recomendado para novos usuários →</p>
          </button>
          <button type="button" onClick={() => setSetupMode('advanced')}
            className="text-left p-5 rounded-2xl border border-border hover:bg-muted/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-semibold text-sm">Avançado</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Controle total : templates, base de conhecimento, integrações e simulador.</p>
            <p className="text-[11px] text-muted-foreground font-medium mt-3">Para usuários experientes →</p>
          </button>
        </div>
      </div>
    )
  }

  // ── Quick onboarding ───────────────────────────────────────────────────
  if (setupMode === 'quick') {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={() => setSetupMode('choosing')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Configuração Rápida</h1>
            <p className="text-xs text-muted-foreground">Seu agente pronto em minutos</p>
          </div>
          <button type="button" onClick={() => setSetupMode('advanced')}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">
            Ir para avançado →
          </button>
        </div>
        <QuickOnboarding onComplete={async ({ persona: newPersona, nicheId }) => {
          setConfig((prev) => ({ ...prev, persona: newPersona }))
          setSharedNicheId(nicheId)
          setSaving(true)
          try {
            const res = await fetch('/api/sdr/config', {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agent_type: config.agent_type,
                prompt: JSON.stringify({ ...newPersona, nicho_id: nicheId }),
                agente_ativo: config.agente_ativo,
                conhecimento_ativo: true, objecoes_ativo: false,
                inbox_mode: config.inbox_mode,
              }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            if (data.config?.flow_id) setConfig((p) => ({ ...p, flow_id: data.config.flow_id }))
            toast({ title: 'Agente criado! Agora gere a base de conhecimento.' })
            setSetupMode('advanced')
            setActiveTab('conhecimento')
          } catch (err: any) {
            toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
          } finally { setSaving(false) }
        }} />
      </div>
    )
  }

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
    <>
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AutomationsNav active="sdr" />
        <Link href="/configuracoes/sdr/funil" className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">Funil da conversa</Link>
      </div>

      {/* ── Hero: agente + status ── */}
      <div className={cn(
        'rounded-2xl border p-5 flex items-center gap-5 transition-colors',
        config.agente_ativo ? 'bg-primary/5 border-primary/20' : 'bg-muted/20 border-border'
      )}>
        {/* Avatar */}
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors',
          config.agente_ativo ? 'bg-primary/15' : 'bg-muted'
        )}>
          <Bot className={cn('w-7 h-7', config.agente_ativo ? 'text-primary' : 'text-muted-foreground')} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">
              {config.persona.nome_agente || 'Agente SDR'}
            </h1>
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
              config.agente_ativo
                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400'
                : 'bg-muted text-muted-foreground border-border'
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', config.agente_ativo ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50')} />
              {config.agente_ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground">Atendimento automático via WhatsApp</span>
            {/* WhatsApp status */}
            <span className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              isConnected ? 'text-emerald-600 dark:text-emerald-400'
                : isConnecting ? 'text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground'
            )}>
              {isConnected
                ? <><Wifi className="w-3 h-3" />{config.instance_phone || 'Conectado'}</>
                : isConnecting
                ? <><Loader2 className="w-3 h-3 animate-spin" />Conectando…</>
                : <><WifiOff className="w-3 h-3" />Desconectado</>
              }
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled={validating}
            onClick={handleDiagnosticar}
            className="gap-1.5 hidden sm:flex"
          >
            {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
            {validating ? 'Analisando…' : 'Diagnosticar SDR'}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {config.agente_ativo ? 'Desativar' : 'Ativar'}
            </span>
            <Switch
              checked={config.agente_ativo}
              onCheckedChange={(v) => setConfig((p) => ({ ...p, agente_ativo: v }))}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex gap-6">

        {/* ── Nav tabs ── */}
        <aside className="w-44 shrink-0 space-y-0.5">
          {TABS.map(({ id, label, icon }, idx) => (
            <TabButton
              key={id}
              id={id}
              label={label}
              icon={icon}
              isActive={activeTab === id}
              showChevron={idx < TABS.length - 1 && activeTab === id}
              onClick={() => setActiveTab(id)}
            />
          ))}
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">

          {/* Non-conhecimento tabs */}
          {activeTab !== 'conhecimento' && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-5">

                {/* ── Geral ── */}
                {activeTab === 'geral' && (
                  <div className="space-y-5">

                    {/* Tipo de agente */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tipo de agente</p>
                      <div className="grid grid-cols-2 gap-3">
                        {AGENT_TYPES.map((opt) => {
                          const Icon = opt.icon
                          const selected = config.agent_type === opt.value
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setConfig((p) => ({ ...p, agent_type: opt.value as any }))}
                              className={cn(
                                'group relative text-left p-4 rounded-xl border-2 transition-all',
                                selected
                                  ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                                  : 'border-border hover:border-border/80 hover:bg-muted/30'
                              )}
                            >
                              {selected && (
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
                              )}
                              <div className={cn(
                                'w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-colors',
                                selected ? 'bg-primary/15' : 'bg-muted group-hover:bg-muted/70'
                              )}>
                                <Icon className={cn('w-4.5 h-4.5', selected ? 'text-primary' : 'text-muted-foreground')} />
                              </div>
                              <p className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>{opt.label}</p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Modo de atendimento */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Modo de atendimento</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { value: 'suporte', label: 'Suporte', desc: 'Inbox compartilhado : qualquer atendente pode pegar', icon: MessageSquare },
                          { value: 'vendas', label: 'Vendas', desc: 'Distribui automaticamente entre os atendentes (round-robin)', icon: Zap },
                        ] as const).map((opt) => {
                          const selected = config.inbox_mode === opt.value
                          const Icon = opt.icon
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setConfig((p) => ({ ...p, inbox_mode: opt.value }))}
                              className={cn(
                                'group relative text-left p-4 rounded-xl border-2 transition-all',
                                selected
                                  ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                                  : 'border-border hover:border-border/80 hover:bg-muted/30'
                              )}
                            >
                              {selected && (
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
                              )}
                              <div className={cn(
                                'w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-colors',
                                selected ? 'bg-primary/15' : 'bg-muted group-hover:bg-muted/70'
                              )}>
                                <Icon className={cn('w-4 h-4', selected ? 'text-primary' : 'text-muted-foreground')} />
                              </div>
                              <p className={cn('text-sm font-semibold', selected ? 'text-primary' : 'text-foreground')}>{opt.label}</p>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
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
                            <span className={cn('flex items-center gap-2', identSelectedNiche ? 'text-foreground' : 'text-muted-foreground')}>
                              {identSelectedNiche && <NicheIcon id={identSelectedNiche.id} className="w-3.5 h-3.5 shrink-0" />}
                              {identSelectedNiche ? identSelectedNiche.label : 'Selecione o nicho…'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                          {identNicheOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-border bg-background shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                              {[{ label: 'Vendas', items: identVendas }, { label: 'Atendimento', items: identAtendimento }].map((group) => (
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
                                      <NicheIcon id={n.id} className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
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
                      <Field label="O que nunca dizer" hint="Restrições e comportamentos que o agente deve evitar." optional>
                        <Textarea value={config.persona.restricoes} onChange={(e) => setPersona('restricoes', e.target.value)} placeholder="Ex: não mencione preços sem entender a necessidade do cliente" className="min-h-[72px] text-sm resize-none" />
                      </Field>
                    </div>
                  )}

                  {/* ── Integrações ── */}
                  {activeTab === 'integracoes' && (
                    <div className="space-y-5">

                      {/* ── WhatsApp via Meta Cloud API (CoEx) ── */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">WhatsApp : Meta Cloud API</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium ml-auto">Oficial</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Conecte via CoEx : número permanece ativo no WhatsApp Business App e na API simultaneamente.
                        </p>
                        <MetaWhatsAppConnect
                          connected={config.whatsapp_provider === 'meta' && !!config.meta_wa_phone_number_id}
                          phoneNumber={config.meta_wa_phone_number_id}
                          onConnected={(phoneNumberId, wabaId, token, phone) => {
                            setConfig((p) => ({
                              ...p,
                              whatsapp_provider: 'meta',
                              meta_wa_phone_number_id: phoneNumberId,
                              meta_wa_waba_id: wabaId,
                              meta_wa_token: token,
                              instance_phone: phone,
                              instance_status: 'connected',
                            }))
                          }}
                          onDisconnect={async () => {
                            const res = await fetch('/api/meta/whatsapp/connect', { method: 'DELETE' })
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}))
                              toast({ title: `Erro ao desconectar: ${err?.error ?? res.status}`, variant: 'destructive' })
                              return
                            }
                            setConfig((p) => ({
                              ...p,
                              whatsapp_provider: 'uazapi',
                              meta_wa_phone_number_id: null,
                              meta_wa_waba_id: null,
                              meta_wa_token: null,
                            }))
                            toast({ title: 'Meta WhatsApp desconectado' })
                          }}
                        />
                      </div>

                      <div className="border-t border-border" />

                      {/* ── Conta de anúncios Meta (CAC por anúncio) ── */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">Conta de Anúncios Meta</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium ml-auto">CAC por anúncio</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Conecta a conta de anúncios pra calcular custo por lead qualificado e por cliente, por anúncio (Dashboard de Time).
                        </p>
                        <MetaAdsConnect
                          connected={!!config.meta_ad_account_id}
                          accountName={config.meta_ad_account_name}
                          onConnected={(adAccountId, name) => {
                            setConfig((p) => ({ ...p, meta_ad_account_id: adAccountId, meta_ad_account_name: name }))
                          }}
                          onDisconnect={async () => {
                            const res = await fetch('/api/meta/ads/connect', { method: 'DELETE' })
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}))
                              toast({ title: `Erro ao desconectar: ${err?.error ?? res.status}`, variant: 'destructive' })
                              return
                            }
                            setConfig((p) => ({ ...p, meta_ad_account_id: null, meta_ad_account_name: null }))
                            toast({ title: 'Conta de anúncios desconectada' })
                          }}
                        />
                      </div>

                      <div className="border-t border-border" />

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
                          placeholder="Ex: Call de vendas : {nome}"
                          value={config.event_title_template}
                          onChange={(e) => setConfig((p) => ({ ...p, event_title_template: e.target.value }))}
                        />
                      </div>

                      <div className="border-t border-border" />

                      {/* ── Meta Pixel : Conversions API ── */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">Meta Pixel : Conversions API</p>
                          {config.meta_pixel_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium ml-auto">Configurado</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Dispara eventos de conversão server-side quando um lead é fechado : inclui <code className="bg-muted px-1 rounded">ctwa_clid</code> para atribuição precisa de anúncios CTWA.
                        </p>
                        {config.meta_pixel_id ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">Pixel <code className="bg-muted px-1 rounded">{config.meta_pixel_id}</code> ativo</p>
                              <p className="text-[10px] text-muted-foreground">Token configurado · evento Purchase disparado ao fechar conversa</p>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => { setPixelDraft({ id: config.meta_pixel_id ?? '', token: '' }); setConfig((p) => ({ ...p, meta_pixel_id: null, meta_pixel_token: null })) }}>
                              Alterar
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground mb-1">Pixel ID</p>
                                <Input placeholder="1234567890123456" value={pixelDraft.id}
                                  onChange={(e) => setPixelDraft((p) => ({ ...p, id: e.target.value }))} className="h-8 text-sm" />
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground mb-1">Access Token</p>
                                <Input type="password" placeholder="EAAxxxxx..." value={pixelDraft.token}
                                  onChange={(e) => setPixelDraft((p) => ({ ...p, token: e.target.value }))} className="h-8 text-sm" />
                              </div>
                            </div>
                            <Button size="sm" className="h-8 text-xs" disabled={!pixelDraft.id || !pixelDraft.token || savingPixel}
                              onClick={handleSavePixel}>
                              {savingPixel ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                              Salvar Pixel
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-border" />

                      {/* ── Cobrança automática (Asaas) : só leitura, ativa em /configuracoes ── */}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <ShoppingBag className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-sm font-semibold">Cobrança automática</p>
                          {asaasStatus === 'active' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium ml-auto">Asaas ativo</span>
                          )}
                          {asaasStatus === 'inactive' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">Não conectado</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          Quando o Asaas está ativo, a Zaia pode gerar cobrança de verdade (PIX, boleto ou cartão) e mandar o link direto na conversa, sem handoff humano.
                        </p>
                        {asaasStatus === 'loading' ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando...
                          </div>
                        ) : asaasStatus === 'active' ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <p className="text-xs">A Zaia já enxerga o Asaas ativo pra essa empresa e pode gerar cobrança em tempo real.</p>
                            </div>
                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                              <div className="min-w-0">
                                <p className="text-xs font-medium">Cobrança recorrente (assinatura)</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {config.billing_recurring
                                    ? 'Assinatura mensal, cobrada automaticamente no cartão : só cartão fica disponível pro lead.'
                                    : 'Cobrança avulsa, paga uma vez. PIX, boleto ou cartão à escolha do lead.'}
                                </p>
                              </div>
                              <Switch
                                checked={config.billing_recurring}
                                onCheckedChange={(v) => setConfig((p) => ({ ...p, billing_recurring: v }))}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border border-border">
                            <p className="text-xs text-muted-foreground">Asaas não está ativo : a Zaia não consegue gerar cobrança sozinha ainda.</p>
                            <Link href="/configuracoes?tab=integracoes" className="text-xs text-primary hover:underline whitespace-nowrap shrink-0">
                              Ativar em Configurações →
                            </Link>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-border" />

                      {/* ── Google Ads : Enhanced Conversions ── */}
                      <GoogleAdsSection />

                      <div className="border-t border-border" />

                      {/* ── Links Rastreados : captura de gclid ── */}
                      <TrackingLinksManager />
                    </div>
                  )}

                  {/* ── Horários ── */}
                  {activeTab === 'horarios' && (
                    <div className="space-y-4">
                      <HorarioContent />
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
          )}

          {/* ── Conhecimento : split panel ── */}
          {activeTab === 'conhecimento' && (
            <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[560px]">
              {/* Left : KB config */}
              <div className="w-[360px] shrink-0 overflow-y-auto pr-2 space-y-6 pb-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-sm font-semibold">Assistente de criação</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Responda 9 passos e o assistente monta a base de conhecimento e a de objeções de uma vez, com a regra de preço travada.
                  </p>
                  <Button size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => setAssistantOpen(true)} disabled={!config.flow_id}>
                    <Sparkles className="w-3 h-3" />Criar agente de vendas
                  </Button>
                  {!config.flow_id && <p className="text-[11px] text-amber-600">Salve a configuração antes de criar o agente.</p>}
                </div>
                <AgentAssistant
                  open={assistantOpen}
                  onClose={() => setAssistantOpen(false)}
                  flowId={config.flow_id}
                  variables={buildSdrVariables(config.persona)}
                  agentActive={config.agente_ativo}
                  hasExistingBase={hasExistingBase}
                  onAgentName={(name) => setPersona('nome_agente', name)}
                  onBuilt={() => { setKbRefresh((k) => k + 1); void handleSaveRef.current() }}
                  onCreated={() => setAssistantOpen(false)}
                />
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
                    onOpenAssistant={() => setAssistantOpen(true)}
                    refreshKey={kbRefresh}
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
                    onOpenAssistant={() => setAssistantOpen(true)}
                    refreshKey={kbRefresh}
                  />
                </div>

                <DicaDeOuro />
              </div>

              {/* Right : Simulator */}
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

    {/* ── Validation Widget ────────────────────────────────────────────── */}
    {showValidationModal && validationResult && (
      <SdrDiagnosticoWidget
        result={validationResult}
        persona={config.persona as unknown as Record<string, string>}
        onClose={() => setShowValidationModal(false)}
        onNavigate={(tab) => {
          setShowValidationModal(false)
          setActiveTab(tab)
        }}
      />
    )}

    </>
  )
}
