'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bell, Settings, Search, Download, Plus, X, ChevronDown, ChevronRight, ChevronLeft,
  User, MessageCircle, Star, FileText, CheckCircle2, DollarSign, RotateCcw,
  LineChart, Clock, Workflow, Users, Megaphone, HelpCircle, Table, Columns, TrendingUp, Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ============================================================
   Demo interativo do Kanban — recriado em HTML/CSS a partir do
   design no Paper (21 telas). Canvas base 1920×1080 (2x do
   design 960×540), escalado para caber no container.
   Tokens extraídos do Paper:
   - primário #01573C / sombra #07261C — pill, texto #D8D8D8
   - secundário #141414 / sombra #1F1F1F
   - inputs #141414, borda #212121, pill (radius 22)
   - lime #96F63C · avatar ring #90FC1D
   - tooltip #1A1A1A, borda #2B2B2B, sombra offset #07261C
   ============================================================ */

const W = 1920
const H = 1080
const LIME = '#96F63C'
const GREEN = '#01573C'
const GREEN_DARK = '#07261C'

type SpotId =
  | 'menu-kanban' | 'card-drag' | 'card-drop' | 'card-moved' | 'novo-lead'
  | 'f-empresa' | 'f-segmento' | 'f-continuar' | 'f-contato' | 'f-whats' | 'f-email'
  | 'f-estagio' | 'f-prioridade' | 'f-interesse' | 'f-fonte' | 'f-valor' | 'f-obs'

interface Step {
  caption: string
  scene: 'dash' | 'kanban' | 'final'
  menuOpen?: boolean
  drag?: boolean
  moved?: boolean
  modal?: 0 | 1 | 2
  spot?: SpotId
  tip?: string
}

const STEPS: Step[] = [
  { scene: 'dash', caption: 'Visão geral do dashboard — métricas, funil e conversão em tempo real' },
  { scene: 'dash', menuOpen: true, spot: 'menu-kanban', tip: 'Selecione a visualização Kanban.', caption: 'Selecione a visualização Kanban no menu lateral' },
  { scene: 'kanban', caption: 'Visualize todos os leads organizados por etapa da venda' },
  { scene: 'kanban', spot: 'card-drag', tip: 'Clique e arraste o card para a etapa desejada.', caption: 'Clique e arraste o card para a etapa desejada' },
  { scene: 'kanban', drag: true, spot: 'card-drop', tip: 'Solte para mover o lead de etapa.', caption: 'Solte para mover o lead de etapa' },
  { scene: 'kanban', moved: true, spot: 'card-moved', tip: 'Lead movido, atualizado em tempo real para toda a equipe.', caption: 'Lead movido — atualizado em tempo real para toda a equipe' },
  { scene: 'kanban', moved: true, spot: 'novo-lead', tip: 'Clique aqui para cadastrar um novo lead.', caption: 'Clique aqui para cadastrar um novo lead' },
  { scene: 'kanban', moved: true, modal: 0, spot: 'f-empresa', tip: 'Digite o nome da empresa.', caption: 'Digite o nome da empresa' },
  { scene: 'kanban', moved: true, modal: 0, spot: 'f-segmento', tip: 'Selecione o segmento de atuação.', caption: 'Selecione o segmento de atuação' },
  { scene: 'kanban', moved: true, modal: 0, spot: 'f-continuar', tip: 'Clique em continuar.', caption: 'Clique em continuar' },
  { scene: 'kanban', moved: true, modal: 1, spot: 'f-contato', tip: 'Digite o nome do contato.', caption: 'Digite o nome do contato' },
  { scene: 'kanban', moved: true, modal: 1, spot: 'f-whats', tip: 'Digite o número de WhatsApp.', caption: 'Digite o número de WhatsApp' },
  { scene: 'kanban', moved: true, modal: 1, spot: 'f-email', tip: 'Digite o e-mail.', caption: 'Digite o e-mail' },
  { scene: 'kanban', moved: true, modal: 2, spot: 'f-estagio', tip: 'Selecione em qual etapa do funil esse lead se encontra. Isso define onde ele aparece no kanban.', caption: 'Selecione em qual etapa do funil esse lead se encontra' },
  { scene: 'kanban', moved: true, modal: 2, spot: 'f-prioridade', tip: 'Indique o nível de atenção que esse lead exige: Baixa, Média ou Alta.', caption: 'Indique o nível de atenção que esse lead exige: Baixa, Média ou Alta' },
  { scene: 'kanban', moved: true, modal: 2, spot: 'f-interesse', tip: 'Classifique o nível de interesse — Quente indica alta intenção de compra.', caption: 'Classifique o nível de interesse — Quente indica alta intenção de compra' },
  { scene: 'kanban', moved: true, modal: 2, spot: 'f-fonte', tip: 'Registre de onde esse lead veio — essencial para medir quais canais geram mais negócios.', caption: 'Registre de onde esse lead veio — essencial para medir quais canais geram mais negócios' },
  { scene: 'kanban', moved: true, modal: 2, spot: 'f-valor', tip: 'Informe o valor estimado do negócio para calcular o total do pipeline.', caption: 'Informe o valor estimado do negócio para calcular o total do pipeline' },
  { scene: 'kanban', moved: true, modal: 2, spot: 'f-obs', tip: 'Campo livre para registrar contexto, histórico ou próximos passos.', caption: 'Campo livre para registrar contexto, histórico ou próximos passos' },
  { scene: 'kanban', moved: true, modal: 2, spot: 'f-continuar', tip: 'Confira as informações e clique para avançar. O lead será salvo ao finalizar o cadastro.', caption: 'Confira as informações e clique para avançar — o lead será salvo ao finalizar' },
  { scene: 'final', caption: 'Pronto! Seu lead foi cadastrado e já aparece no kanban' },
]

/* ---------- marcador + tooltip (hotspot do design) ---------- */

function TipBox({ text }: { text: string }) {
  return (
    <div className="relative flex-shrink-0">
      <div className="absolute rounded-[4px]" style={{ inset: 0, transform: 'translate(10px, 10px)', backgroundColor: GREEN_DARK }} />
      <div
        className="relative rounded-[4px] text-center"
        style={{
          backgroundColor: '#1A1A1A', border: '1px solid #2B2B2B', padding: '16px 22px',
          color: '#FFFFFF', fontSize: 26, lineHeight: '34px', fontWeight: 400,
          fontFamily: 'Montserrat, system-ui, sans-serif', minWidth: 230, maxWidth: 480, width: 'max-content',
        }}
      >
        {text}
      </div>
    </div>
  )
}

function Ring() {
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{ width: 24, height: 24, border: `2.5px solid ${LIME}`, boxShadow: '0 0 10px rgba(150,246,60,0.45)' }}
    />
  )
}

function Spot({
  active, tip, side = 'right', gap = 28, block = true, children,
}: {
  active: boolean; tip?: string; side?: 'right' | 'left'; gap?: number; block?: boolean; children: React.ReactNode
}) {
  return (
    <div className="relative" style={{ display: block ? 'block' : 'inline-block' }}>
      {children}
      {active && tip && (
        <div
          className="absolute z-[60] flex items-center"
          style={
            side === 'right'
              ? { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 }
              : { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8, flexDirection: 'row-reverse' }
          }
        >
          <Ring />
          <div style={{ width: gap, height: 1.5, backgroundColor: '#3A3A3A', flexShrink: 0 }} />
          <TipBox text={tip} />
        </div>
      )}
    </div>
  )
}

/* ---------- botão 3D (duas camadas, igual ao Paper) ---------- */

function Btn3D({
  variant = 'primary', children, style,
}: { variant?: 'primary' | 'secondary'; children: React.ReactNode; style?: React.CSSProperties }) {
  const face = variant === 'primary' ? GREEN : '#141414'
  const shadow = variant === 'primary' ? GREEN_DARK : '#1F1F1F'
  return (
    <div
      className="rounded-full flex items-center justify-center gap-1.5 flex-shrink-0"
      style={{
        height: 34, padding: '0 20px', backgroundColor: face, boxShadow: `0 4px 0 0 ${shadow}`,
        color: '#D8D8D8', fontSize: 13, fontWeight: 700, ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ---------- sidebar ---------- */

function SideItem({
  icon: Icon, label, active, chevron,
}: { icon: any; label: string; active?: boolean; chevron?: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-md"
      style={{
        height: 34, padding: '0 10px',
        backgroundColor: active ? 'rgba(25,25,25,0.8)' : 'transparent',
        color: active ? '#E8E8E8' : '#9A9A9A', fontSize: 13, fontWeight: 500,
      }}
    >
      <Icon size={15} strokeWidth={2} />
      <span className="flex-1 truncate">{label}</span>
      {chevron && <ChevronRight size={11} color="#555" />}
    </div>
  )
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 600, color: '#5A5A5A', letterSpacing: '0.14em', padding: '0 10px', marginBottom: 6 }}>
      {children}
    </p>
  )
}

function LogoMark({ size = 24, fontSize = 12 }: { size?: number; fontSize?: number }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div
        className="rounded-full flex items-center justify-center w-full h-full"
        style={{ backgroundColor: '#0E5B3F' }}
      >
        <span style={{ color: '#fff', fontWeight: 800, fontSize, lineHeight: 1 }}>z</span>
      </div>
      <div
        className="absolute"
        style={{
          width: size * 0.22, height: size * 0.22, backgroundColor: '#0E5B3F',
          bottom: -size * 0.04, left: size * 0.14, transform: 'rotate(45deg)',
        }}
      />
    </div>
  )
}

function Sidebar({ active }: { active: 'dash' | 'crm' }) {
  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width: 224, backgroundColor: '#101010', borderRight: '1px solid #1A1A1A', padding: '16px 12px 14px' }}
    >
      <div className="flex items-center gap-2" style={{ padding: '0 6px' }}>
        <LogoMark />
        <span style={{ color: '#E8E8E8', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>zaapply</span>
        <ChevronLeft size={12} color="#666" className="ml-auto" />
      </div>

      <div style={{ marginTop: 22 }}>
        <SideLabel>PRINCIPAL</SideLabel>
        <SideItem icon={LineChart} label="Dashboard" active={active === 'dash'} />
      </div>
      <div style={{ marginTop: 14 }}>
        <SideLabel>FERRAMENTAS</SideLabel>
        <SideItem icon={Clock} label="CRM" active={active === 'crm'} chevron />
        <SideItem icon={MessageCircle} label="Atendimento" />
        <SideItem icon={Workflow} label="Automações" chevron />
      </div>
      <div style={{ marginTop: 14 }}>
        <SideLabel>GESTÃO</SideLabel>
        <SideItem icon={Users} label="Membros" />
      </div>
      <div style={{ marginTop: 14 }}>
        <SideLabel>SISTEMA</SideLabel>
        <SideItem icon={Megaphone} label="Novidades" />
        <SideItem icon={HelpCircle} label="Ajuda" chevron />
        <SideItem icon={Settings} label="Configurações" />
      </div>

      <div className="flex-1" />

      {/* card de tokens (glassmorphism do design) */}
      <div
        className="rounded-[10px]"
        style={{
          padding: 14,
          background: 'linear-gradient(135deg, rgba(7,38,28,0.85) 0%, rgba(14,64,40,0.85) 56%, rgba(10,48,30,0.85) 100%)',
          border: '1px solid rgba(96,246,60,0.18)',
        }}
      >
        <p style={{ fontSize: 9.5, color: '#9FB8AC' }}>Tokens mensais</p>
        <p style={{ fontSize: 9.5, color: '#9FB8AC' }}>Zaapply Start</p>
        <p style={{ marginTop: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>7.792</span>
          <span style={{ fontSize: 9.5, color: '#7E9C8E' }}> / 5.000.000</span>
        </p>
        <div className="rounded-full overflow-hidden" style={{ height: 3, backgroundColor: '#0C0C0C', marginTop: 8 }}>
          <div className="h-full rounded-full" style={{ width: '3%', backgroundColor: LIME }} />
        </div>
        <p style={{ fontSize: 9.5, color: '#9FB8AC', marginTop: 7 }}>1% utilizado</p>
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            height: 26, marginTop: 10, backgroundColor: '#101010', border: '1px solid #212121',
            boxShadow: '0 3px 0 0 #0C0C0C', color: '#E0E0E0', fontSize: 10, fontWeight: 600,
          }}
        >
          Fazer upgrade
        </div>
      </div>

      <div className="rounded-md text-center" style={{ marginTop: 12, backgroundColor: '#161616', padding: '9px 8px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#E8E8E8' }}>Zaapply</p>
        <p style={{ fontSize: 9, color: '#8A8A8A', marginTop: 2 }}>admin@zaapply.com.br</p>
      </div>
    </div>
  )
}

/* ---------- header (gradiente #01573C → #07261C, brightness 150%) ---------- */

function TopHeader() {
  return (
    <div className="relative rounded-[20px] overflow-hidden flex-shrink-0" style={{ height: 108, marginTop: 24 }}>
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(270deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`, filter: 'brightness(1.5)' }}
      />
      <div className="relative h-full flex items-center justify-between" style={{ padding: '0 28px' }}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/demo/avatar.png"
            alt=""
            className="rounded-full object-cover flex-shrink-0"
            style={{ width: 42, height: 42, border: '2px solid #90FC1D' }}
          />
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#D4D4D4', lineHeight: 1 }}>Rodrigo Silva ✌️</p>
            <p style={{ fontSize: 12, color: '#D4D4D4', opacity: 0.6, marginTop: 5 }}>admin@zaapply.com.br</p>
          </div>
        </div>
        <div className="flex items-center gap-4" style={{ color: 'rgba(255,255,255,0.78)' }}>
          <Bell size={20} />
          <Settings size={20} />
        </div>
      </div>
    </div>
  )
}

/* ---------- dashboard (telas 1–2) ---------- */

function MetricCard({
  icon: Icon, title, badge, badgeColor, value, sub,
}: { icon: any; title: string; badge?: string; badgeColor?: 'lime' | 'red'; value: string; sub: string }) {
  return (
    <div className="rounded-[10px] flex-1" style={{ backgroundColor: '#101010', border: '1px solid #1A1A1A', padding: '16px 18px' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={15} color={LIME} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#E5E5E5' }}>{title}</span>
        </div>
        {badge && (
          <span
            className="rounded-full"
            style={{
              fontSize: 9.5, fontWeight: 700, padding: '3px 8px',
              backgroundColor: badgeColor === 'red' ? 'rgba(239,68,68,0.12)' : 'rgba(150,246,60,0.12)',
              color: badgeColor === 'red' ? '#EF4444' : LIME,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <p style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginTop: 14, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11.5, color: '#777', marginTop: 8 }}>{sub}</p>
    </div>
  )
}

function DashScene({ menuOpen, spot, tip }: { menuOpen?: boolean; spot?: SpotId; tip?: string }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ padding: '0 24px' }}>
      <TopHeader />

      <div className="flex items-end justify-between" style={{ marginTop: 26 }}>
        <div>
          <p style={{ fontSize: 38, fontWeight: 700, color: '#fff', lineHeight: 1 }}>Bom dia, Zaapply 👋</p>
          <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Segunda-feira, 8 de junho de 2026</p>
        </div>
        <div className="flex items-center gap-2">
          {['Hoje', 'Semana', 'Mês', 'Ano', 'personalizado'].map((p) => (
            <span
              key={p}
              className="rounded-full"
              style={
                p === 'Mês'
                  ? { fontSize: 12, fontWeight: 600, color: '#111', backgroundColor: '#E8E8E8', padding: '5px 14px' }
                  : { fontSize: 12, color: '#999', padding: '5px 8px' }
              }
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-4" style={{ marginTop: 24 }}>
        <MetricCard icon={User} title="Novos leads" badge="↗ 100%" value="10" sub="1 lead no período" />
        <MetricCard icon={MessageCircle} title="Em atendimento" value="10" sub="1 lead no período" />
        <MetricCard icon={TrendingUp} title="Taxa de conversão" badge="↘ 50%" badgeColor="red" value="50%" sub="Fechados / entrados" />
        <MetricCard icon={Briefcase} title="Em negociação" value="R$ 0,00" sub="Valor em pipeline" />
        <MetricCard icon={DollarSign} title="Faturamento" badge="↗ 100%" value="R$ 200,00" sub="Fechados no período" />
      </div>

      <div className="flex gap-4" style={{ marginTop: 20, height: 430 }}>
        {/* performance de vendas */}
        <div className="rounded-[10px] flex flex-col" style={{ flex: 2.05, backgroundColor: '#101010', border: '1px solid #1A1A1A', padding: 22 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Performance de vendas</p>
          <div className="flex-1 relative" style={{ marginTop: 16 }}>
            <div className="absolute rounded-sm" style={{ left: 80, bottom: 34, width: 205, top: 24, backgroundColor: '#15543C' }} />
            <p className="absolute" style={{ left: 145, bottom: 8, fontSize: 12, color: '#888' }}>Sem 1</p>
            <p className="absolute" style={{ left: '76%', bottom: 8, fontSize: 12, color: '#888' }}>Sem 2</p>
          </div>
          <div className="flex items-center justify-center gap-5" style={{ marginTop: 10 }}>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: '#999' }}>
              <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: '#34B270' }} /> Leads atendidos
            </span>
            <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: '#999' }}>
              <span className="rounded-full" style={{ width: 8, height: 8, backgroundColor: '#1F6B4A' }} /> Leads fechados
            </span>
          </div>
        </div>

        {/* taxa de conversão */}
        <div className="rounded-[10px] flex flex-col" style={{ flex: 1, backgroundColor: '#101010', border: '1px solid #1A1A1A', padding: 22 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Taxa de conversão</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <svg width={210} height={210} viewBox="0 0 210 210">
                <circle cx={105} cy={105} r={88} fill="none" stroke="#1A1A1A" strokeWidth={15} />
                <circle
                  cx={105} cy={105} r={88} fill="none" stroke="#34B270" strokeWidth={15} strokeLinecap="round"
                  strokeDasharray={`${Math.PI * 88} ${Math.PI * 176}`} transform="rotate(-90 105 105)"
                />
              </svg>
              <div className="absolute text-center">
                <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>50%</p>
                <p style={{ fontSize: 13, color: '#999', marginTop: 6 }}>Conversão</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4">
            <span className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: '#999' }}>
              <span className="rounded-full" style={{ width: 7, height: 7, backgroundColor: '#34B270' }} /> Leads atendidos
            </span>
            <span style={{ fontSize: 11.5, color: '#999' }}>Leads fechados</span>
          </div>
        </div>
      </div>

      {/* funil + vendas recentes (cortado pela borda inferior, como no design) */}
      <div className="flex gap-4" style={{ marginTop: 16 }}>
        <div className="rounded-[10px]" style={{ flex: 2.05, backgroundColor: '#101010', border: '1px solid #1A1A1A', padding: 22 }}>
          <div className="flex items-center gap-3">
            <span className="rounded-full" style={{ fontSize: 12, fontWeight: 600, color: '#fff', backgroundColor: '#0F3D2B', padding: '6px 16px' }}>
              Funil de vendas
            </span>
            <span style={{ fontSize: 12, color: '#999' }}>Anti noshow</span>
            <span style={{ fontSize: 12, color: '#999' }}>Remarketing</span>
          </div>
          <div
            className="rounded-md flex items-center justify-between"
            style={{ marginTop: 18, width: '56%', height: 36, backgroundColor: '#15543C', padding: '0 14px' }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff' }}>Lead novo</span>
            <X size={11} color="rgba(255,255,255,0.6)" />
          </div>
        </div>
        <div className="rounded-[10px]" style={{ flex: 1, backgroundColor: '#101010', border: '1px solid #1A1A1A', padding: 22 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Vendas recentes</p>
        </div>
      </div>

      {/* submenu CRM (tela 2) */}
      {menuOpen && (
        <div className="absolute z-30" style={{ left: 6, top: 232 }}>
          <div className="rounded-lg" style={{ width: 178, backgroundColor: '#161616', border: '1px solid #262626', padding: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: '#6A6A6A', letterSpacing: '0.1em', padding: '4px 8px' }}>CRM</p>
            <div className="flex items-center gap-2 rounded-md" style={{ padding: '7px 8px', color: '#CFCFCF', fontSize: 12.5 }}>
              <Table size={13} color="#BBB" /> Planilha
            </div>
            <Spot active={spot === 'menu-kanban'} tip={tip}>
              <div className="flex items-center gap-2 rounded-md" style={{ padding: '7px 8px', color: '#CFCFCF', fontSize: 12.5 }}>
                <Columns size={13} color="#BBB" /> Kanban
              </div>
            </Spot>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- kanban (telas 3–7 + fundo do modal) ---------- */

interface Lead { name: string; seg: string }
const SAMARINA: Lead = { name: 'Samarina', seg: 'Software' }
const ATUALIZA: Lead = { name: 'Atualiza Modas', seg: 'Moda' }
const ULTRA: Lead = { name: 'Ultra +', seg: 'Drogaria' }

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-[10px]" style={{ backgroundColor: '#101010', border: '1px solid #1A1A1A', padding: 14 }}>
      <div className="flex items-center gap-3">
        <div className="rounded-full flex-shrink-0" style={{ width: 38, height: 38, backgroundColor: '#D9D9D9' }} />
        <div className="min-w-0">
          <p style={{ fontSize: 13.5, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{lead.name}</p>
          <p style={{ fontSize: 12.5, color: '#616161', marginTop: 2 }}>{lead.seg}</p>
        </div>
      </div>
      <span
        className="inline-block rounded-[4px]"
        style={{ marginTop: 10, fontSize: 9, fontWeight: 600, color: '#34B270', backgroundColor: 'rgba(1,87,60,0.39)', padding: '3px 9px' }}
      >
        Tecnologia
      </span>
      <div style={{ height: 1, backgroundColor: '#1A1A1A', marginTop: 12 }} />
      <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
        <DollarSign size={13} color={LIME} />
        <span style={{ fontSize: 11, color: '#5A5A5A' }}>03 de jun.</span>
      </div>
    </div>
  )
}

const COLUMNS = [
  { name: 'Lead novo', icon: User, color: LIME },
  { name: 'Em contato', icon: MessageCircle, color: '#FF4D8D' },
  { name: 'Interessado', icon: Star, color: '#2EE6A8' },
  { name: 'Proposta enviada', icon: FileText, color: '#4D9FFF' },
  { name: 'Fechado', icon: CheckCircle2, color: '#34B270' },
]

function KanbanScene({ drag, moved, spot, tip }: { drag?: boolean; moved?: boolean; spot?: SpotId; tip?: string }) {
  const col0: Lead[] = moved ? [ATUALIZA, ULTRA] : [SAMARINA, ATUALIZA, ULTRA]
  const col1: Lead[] = moved ? [SAMARINA] : []

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ padding: '0 24px' }}>
      <TopHeader />

      <div className="flex items-start justify-between" style={{ marginTop: 22 }}>
        <div>
          <p style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1 }}>CRM</p>
          <p style={{ fontSize: 12, color: '#777', marginTop: 6 }}>2 lead - em pipeline - 0 fechados</p>
        </div>
        {/* toggle Planilha / Kanban */}
        <div className="flex items-center rounded-full" style={{ backgroundColor: '#141414', padding: 3 }}>
          <span className="flex items-center gap-1.5" style={{ fontSize: 12, color: '#fff', padding: '4px 12px' }}>
            <Table size={12} /> Planilha
          </span>
          <span
            className="flex items-center gap-1.5 rounded-full"
            style={{ fontSize: 12, fontWeight: 600, color: '#fff', backgroundColor: GREEN_DARK, padding: '4px 12px' }}
          >
            <Columns size={12} /> Kanban
          </span>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-3" style={{ marginTop: 18 }}>
        <div className="flex items-center gap-2 rounded-[4px]" style={{ width: 322, height: 34, border: '1px solid #1A1A1A', padding: '0 12px' }}>
          <Search size={13} color="#777" />
          <span style={{ fontSize: 13, color: '#777' }}>Buscar...</span>
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-[4px]" style={{ width: 146, height: 34, border: '1px solid #1A1A1A', padding: '0 12px' }}>
            <span style={{ fontSize: 13, color: '#999' }}>Todos</span>
            <ChevronDown size={12} color="#777" />
          </div>
        ))}
        <div className="ml-auto flex items-center gap-3">
          <Btn3D variant="secondary"><Download size={13} /> EXPORTAR</Btn3D>
          <Spot active={spot === 'novo-lead'} tip={tip} side="left" gap={28} block={false}>
            <Btn3D><Plus size={13} /> NOVO LEAD</Btn3D>
          </Spot>
        </div>
      </div>

      {/* colunas */}
      <div className="flex gap-4 flex-1" style={{ marginTop: 26 }}>
        {COLUMNS.map((col, ci) => {
          const Icon = col.icon
          return (
            <div key={col.name} className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Icon size={17} color={col.color} />
                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{col.name}</span>
              </div>

              <div className="flex flex-col gap-3 flex-1" style={{ marginTop: 16 }}>
                {ci === 0 && col0.map((lead) => (
                  <Spot key={lead.name} active={spot === 'card-drag' && lead.name === 'Samarina'} tip={tip}>
                    <LeadCard lead={lead} />
                  </Spot>
                ))}

                {ci === 1 && drag && (
                  <div
                    className="rounded-[10px] flex-1"
                    style={{ backgroundColor: 'rgba(1,87,60,0.16)', border: `1px solid ${GREEN}`, padding: 8 }}
                  >
                    <Spot active={spot === 'card-drop'} tip={tip}>
                      <LeadCard lead={SAMARINA} />
                    </Spot>
                  </div>
                )}

                {ci === 1 && !drag && col1.map((lead) => (
                  <Spot key={lead.name} active={spot === 'card-moved'} tip={tip}>
                    <LeadCard lead={lead} />
                  </Spot>
                ))}

                {((ci === 1 && !drag && col1.length === 0) || ci > 1) && (
                  <div
                    className="rounded-[10px] flex items-center justify-center"
                    style={{ height: 80, border: '1px dashed #2A2A2A' }}
                  >
                    <span style={{ fontSize: 12.5, color: '#999' }}>Sem leads</span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- modal Novo lead (telas 8–20) ---------- */

function Control({
  placeholder, select, active, tip, gap = 28, textarea,
}: { placeholder: string; select?: boolean; active?: boolean; tip?: string; gap?: number; textarea?: boolean }) {
  return (
    <Spot active={!!active} tip={tip} gap={gap}>
      <div
        className={cn('flex', textarea ? 'items-start rounded-2xl' : 'items-center justify-between rounded-full')}
        style={{
          height: textarea ? 88 : 44, backgroundColor: '#141414', border: '1px solid #212121',
          padding: textarea ? '12px 18px' : '0 18px',
          ...(active ? { borderColor: 'rgba(150,246,60,0.55)' } : {}),
        }}
      >
        <span style={{ fontSize: 13, color: '#B5B5B5' }}>{placeholder}</span>
        {select && <ChevronDown size={13} color="#777" />}
      </div>
    </Spot>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#E5E5E5', marginBottom: 8 }}>{label}</p>
      {children}
    </div>
  )
}

function NovoLeadModal({ step, spot, tip }: { step: 0 | 1 | 2; spot?: SpotId; tip?: string }) {
  const labels = ['Empresa', 'Contato', 'Detalhes']
  return (
    <>
      <div className="absolute inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
      <div
        className="absolute z-50 rounded-md"
        style={{ left: 704, top: '50%', transform: 'translateY(-50%)', width: 512, backgroundColor: '#0C0C0C', padding: 24 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p style={{ fontSize: 21, fontWeight: 700, color: '#fff', lineHeight: 1 }}>Novo lead</p>
            <p style={{ fontSize: 13, color: '#B5B5B5', marginTop: 7 }}>Informações da empresa</p>
          </div>
          <X size={15} color="#999" />
        </div>

        {/* stepper */}
        <div className="flex gap-2" style={{ marginTop: 22 }}>
          {labels.map((l, i) => (
            <div key={l} className="flex-1">
              <div className="rounded-full" style={{ height: 4, backgroundColor: i <= step ? LIME : '#141414' }} />
              <p
                style={{
                  fontSize: 13, marginTop: 9,
                  color: i <= step ? LIME : '#B5B5B5',
                  textAlign: i === 0 ? 'left' : i === 1 ? 'center' : 'right',
                }}
              >
                {l}
              </p>
            </div>
          ))}
        </div>

        {/* campos */}
        <div className="flex flex-col" style={{ marginTop: 20, gap: 16 }}>
          {step === 0 && (
            <>
              <Field label="Nome da empresa *">
                <Control placeholder="Digite o nome da empresa" active={spot === 'f-empresa'} tip={tip} />
              </Field>
              <Field label="Segmento *">
                <Control placeholder="Selecione o segmento" select active={spot === 'f-segmento'} tip={tip} />
              </Field>
              <Field label="Site ou Instagram *">
                <Control placeholder="https://... ou @usuario" />
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Nome de contato">
                <Control placeholder="Nome da pessoa de contato" active={spot === 'f-contato'} tip={tip} />
              </Field>
              <Field label="WhatsApp *">
                <Control placeholder="55912345678" active={spot === 'f-whats'} tip={tip} />
              </Field>
              <Field label="E-mail">
                <Control placeholder="contato@empresa.com.br" active={spot === 'f-email'} tip={tip} />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <Field label="Estágio">
                <Control placeholder="Lead novo" select active={spot === 'f-estagio'} tip={tip} />
              </Field>
              <div className="flex gap-4">
                <Field label="Prioridade" style={{ flex: 1 }}>
                  <Control placeholder="Média" select active={spot === 'f-prioridade'} tip={tip} gap={300} />
                </Field>
                <Field label="Interesse" style={{ flex: 1 }}>
                  <Control placeholder="Quente 🔥" select active={spot === 'f-interesse'} tip={tip} />
                </Field>
              </div>
              <div className="flex gap-4">
                <Field label="Fonte" style={{ flex: 1 }}>
                  <Control placeholder="Interno" select active={spot === 'f-fonte'} tip={tip} gap={300} />
                </Field>
                <Field label="Valor" style={{ flex: 1 }}>
                  <Control placeholder="R$ 00,00" select active={spot === 'f-valor'} tip={tip} />
                </Field>
              </div>
              <Field label="Observações">
                <Control placeholder="Adicione observações sobre este lead..." textarea active={spot === 'f-obs'} tip={tip} />
              </Field>
            </>
          )}
        </div>

        {/* ações */}
        <div className="flex items-center justify-between" style={{ marginTop: 26 }}>
          <Btn3D variant="secondary" style={{ width: 134 }}>{step === 0 ? 'Cancelar' : 'Voltar'}</Btn3D>
          <Spot active={spot === 'f-continuar'} tip={tip} block={false}>
            <Btn3D style={{ width: 134 }}>Continuar</Btn3D>
          </Spot>
        </div>
      </div>
    </>
  )
}

/* ---------- tela final (tela 21) ---------- */

function FinalScene() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#0A0A0A' }}>
      <div className="flex items-center gap-5">
        <LogoMark size={104} fontSize={52} />
        <span style={{ fontSize: 58, fontWeight: 800, color: '#F2F2F2', letterSpacing: '-0.02em' }}>zaapply</span>
      </div>
    </div>
  )
}

/* ---------- componente principal ---------- */

export function KanbanDemo({ initialSlide = 0 }: { initialSlide?: number }) {
  const [slide, setSlide] = useState(Math.min(Math.max(initialSlide, 0), STEPS.length - 1))
  const [scale, setScale] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = STEPS.length
  const step = STEPS[slide]
  const isLast = slide === total - 1

  return (
    <div className="w-full rounded-2xl border border-border shadow-xl overflow-hidden bg-background">
      <div
        ref={wrapRef}
        className={cn('relative w-full select-none overflow-hidden', !isLast && 'cursor-pointer group')}
        style={{ aspectRatio: '16 / 9' }}
        onClick={() => { if (!isLast) setSlide((s) => s + 1) }}
      >
        {scale > 0 && (
          <div
            className="absolute top-0 left-0 flex"
            style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left', backgroundColor: '#0A0A0A' }}
          >
            {step.scene === 'final' ? (
              <FinalScene />
            ) : (
              <>
                <Sidebar active={step.scene === 'dash' ? 'dash' : 'crm'} />
                {step.scene === 'dash' ? (
                  <DashScene menuOpen={step.menuOpen} spot={step.spot} tip={step.tip} />
                ) : (
                  <KanbanScene
                    drag={step.drag}
                    moved={step.moved}
                    spot={step.modal === undefined ? step.spot : undefined}
                    tip={step.modal === undefined ? step.tip : undefined}
                  />
                )}
                {step.modal !== undefined && <NovoLeadModal step={step.modal} spot={step.spot} tip={step.tip} />}
              </>
            )}
          </div>
        )}

        {!isLast && (
          <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[70]">
            <ChevronRight className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-4">
        <div className="flex gap-1.5 flex-shrink-0">
          {STEPS.map((_, i) => (
            <div key={i} className={cn(
              'rounded-full transition-all duration-300',
              i === slide ? 'w-5 h-1.5 bg-primary' :
              i < slide ? 'w-1.5 h-1.5 bg-primary/50' :
                          'w-1.5 h-1.5 bg-muted-foreground/20'
            )} />
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground flex-1">{step.caption}</p>
        <span className="text-[11px] text-muted-foreground/50 flex-shrink-0 tabular-nums">{slide + 1}/{total}</span>
        {isLast && (
          <button
            onClick={() => setSlide(0)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}
