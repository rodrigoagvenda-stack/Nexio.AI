"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import type { Profile } from "@/types/database.types"
import {
  LayoutDashboard,
  Users,
  Building2,
  Layers,
  Calendar,
  UserCheck,
  Wallet,
  CalendarDays,
  MessageSquare,
  HandHeart,
  Settings,
  X,
  Cross,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  HelpCircle,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface SidebarProps {
  user: Profile
  mobileOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const NAV_GROUPS = [
  {
    label: "Visão Geral",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin","pastor","tesoureiro","secretaria","lider_ministerio"] },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { name: "Membros",     href: "/membros",     icon: Users,     roles: ["admin","pastor","secretaria","lider_ministerio"] },
      { name: "Ministérios", href: "/ministerios", icon: Layers,    roles: ["admin","pastor","lider_ministerio"] },
      { name: "Frequência",  href: "/frequencia",  icon: UserCheck, roles: ["admin","pastor","secretaria"] },
    ],
  },
  {
    label: "Culto & Eventos",
    items: [
      { name: "Escalas", href: "/escalas", icon: Calendar,    roles: ["admin","pastor","secretaria"] },
      { name: "Eventos",  href: "/eventos",  icon: CalendarDays, roles: ["admin","pastor","secretaria"] },
    ],
  },
  {
    label: "Administração",
    items: [
      { name: "Igrejas",     href: "/igrejas",     icon: Building2,    roles: ["admin","pastor"] },
      { name: "Financeiro",  href: "/financeiro",  icon: Wallet,       roles: ["admin","pastor","tesoureiro"] },
      { name: "Comunicação", href: "/comunicacao", icon: MessageSquare,roles: ["admin","pastor","secretaria"] },
    ],
  },
  {
    label: "Pastoral",
    items: [
      { name: "Pedidos de Oração", href: "/pedidos-oracao", icon: HandHeart, roles: ["admin","pastor","lider_ministerio"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      { name: "Configurações", href: "/configuracoes", icon: Settings, roles: ["admin","pastor"] },
    ],
  },
]

const FAQ_ITEMS = [
  { q: "Como cadastrar um membro?", a: 'Acesse "Membros" e clique em "Novo Membro". Preencha os dados e salve.' },
  { q: "Como registrar uma oferta?", a: 'Vá em "Financeiro" → "Novo Lançamento" → selecione tipo "Entrada" e categoria "Ofertas".' },
  { q: "Como criar uma escala de culto?", a: 'Em "Escalas", clique em "Nova Escala", defina o período e adicione os cultos com seus responsáveis.' },
  { q: "Como registrar frequência?", a: 'Acesse "Frequência", selecione a data e o culto, e marque os membros presentes.' },
  { q: "Como adicionar um pedido de oração?", a: 'Em "Pedidos de Oração", clique em "Novo Pedido", preencha título, descrição e categoria.' },
  { q: "Como exportar o relatório financeiro?", a: 'Na página "Financeiro", clique em "Exportar PDF" no canto superior direito.' },
]

export function Sidebar({ user, mobileOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [faqOpen, setFaqOpen] = useState(false)
  const [faqExpanded, setFaqExpanded] = useState<number | null>(null)

  const canAccess = (roles: string[]) => roles.includes(user.role)
  const initials = user.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()

  const sidebarWidth = collapsed ? "w-[60px]" : "w-56"

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      <aside
        data-sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "bg-card border-r border-border",
          "transition-all duration-300 ease-in-out",
          sidebarWidth,
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* ── Logo ── */}
        <div className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-0" : "justify-between px-3"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <Cross className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <span className="text-sm font-bold truncate tracking-tight">IPVB</span>
            )}
          </div>
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 px-1.5 scrollbar-thin">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => canAccess(item.roles))
            if (visibleItems.length === 0) return null

            return (
              <div key={group.label} className="mb-1">
                {!collapsed && (
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
                    {group.label}
                  </p>
                )}
                {collapsed && <div className="h-px bg-border/40 mx-1 my-1" />}
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* ── FAQ ── */}
        {!collapsed && (
          <div className="shrink-0 border-t border-border">
            <button
              onClick={() => setFaqOpen(v => !v)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">Ajuda & FAQ</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", faqOpen && "rotate-180")} />
            </button>
            {faqOpen && (
              <div className="max-h-52 overflow-y-auto border-t border-border bg-muted/30">
                {FAQ_ITEMS.map((item, i) => (
                  <div key={i} className="border-b border-border/50 last:border-0">
                    <button
                      onClick={() => setFaqExpanded(faqExpanded === i ? null : i)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-[11px] font-medium text-foreground/90 leading-snug flex-1">{item.q}</span>
                      <ChevronDown className={cn("h-3 w-3 shrink-0 mt-0.5 text-muted-foreground transition-transform", faqExpanded === i && "rotate-180")} />
                    </button>
                    {faqExpanded === i && (
                      <p className="px-3 pb-2 text-[11px] text-muted-foreground leading-relaxed">{item.a}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Footer: theme + collapse + user ── */}
        <div className={cn(
          "shrink-0 border-t border-border p-2 space-y-1.5"
        )}>
          {/* Theme + collapse row */}
          <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark"
                ? <Sun className="h-3.5 w-3.5" />
                : <Moon className="h-3.5 w-3.5" />
              }
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hidden lg:flex"
              onClick={onToggleCollapse}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5" />
                : <ChevronLeft className="h-3.5 w-3.5" />
              }
            </Button>
          </div>

          {/* User info */}
          <div className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 bg-muted/50",
            collapsed && "justify-center px-0"
          )}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-none truncate">{user.nome.split(" ")[0]}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize truncate">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
