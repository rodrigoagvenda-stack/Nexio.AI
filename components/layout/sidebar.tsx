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
  Calendar,
  UserCheck,
  Wallet,
  CalendarDays,
  MessageSquare,
  HandHeart,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/auth/actions"

interface SidebarProps {
  user: Profile
  mobileOpen: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const NAV_GROUPS = [
  {
    label: "Geral",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin","pastor","tesoureiro","secretaria","lider_ministerio"] },
    ],
  },
  {
    label: "Congregação",
    items: [
      { name: "Membros",    href: "/membros",    icon: Users,     roles: ["admin","pastor","secretaria","lider_ministerio"] },
      { name: "Frequência", href: "/frequencia", icon: UserCheck, roles: ["admin","pastor","secretaria"] },
    ],
  },
  {
    label: "Culto & Eventos",
    items: [
      { name: "Escalas de Culto", href: "/escalas", icon: Calendar,    roles: ["admin","pastor","secretaria"] },
      { name: "Eventos",          href: "/eventos",  icon: CalendarDays, roles: ["admin","pastor","secretaria"] },
    ],
  },
  {
    label: "Gestão",
    items: [
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
      { name: "Igrejas",    href: "/igrejas",    icon: Building2, roles: ["admin","pastor"] },
      { name: "Administrativo", href: "/admin",  icon: Shield,    roles: ["admin","pastor"] },
      { name: "Configurações", href: "/configuracoes", icon: Settings, roles: ["admin","pastor"] },
    ],
  },
]

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  tesoureiro: "Tesoureiro",
  secretaria: "Secretaria",
  lider_ministerio: "Líder",
}

export function Sidebar({ user, mobileOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const canAccess = (roles: string[]) => roles.includes(user.role)
  const initials = user.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()

  const sidebarWidth = collapsed ? "w-[64px]" : "w-60"

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        data-sidebar
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col",
          "bg-[#0f1117] border-r border-white/[0.06]",
          "transition-[width,transform] duration-150 ease-in-out",
          sidebarWidth,
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0"
        )}
      >
        {/* ── Logo ── */}
        <div className={cn(
          "flex h-16 shrink-0 items-center border-b border-white/[0.06]",
          collapsed ? "justify-center px-0" : "justify-between px-4"
        )}>
          {collapsed ? (
            <img
              src="https://wzohmrckjnrpqzizszsi.supabase.co/storage/v1/object/public/user-uploads/logo/LOGO%20(1).png"
              alt="IPVB"
              className="h-9 w-9 object-contain"
            />
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <img
                src="https://wzohmrckjnrpqzizszsi.supabase.co/storage/v1/object/public/user-uploads/logo/Logo%20sidebar.png"
                alt="IPVB"
                className="h-10 w-auto object-contain"
                style={{ maxWidth: "180px" }}
              />
            </div>
          )}
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/10 lg:hidden shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0 scrollbar-thin">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(item => canAccess(item.roles))
            if (visibleItems.length === 0) return null

            return (
              <div key={group.label} className="mb-3">
                {!collapsed && (
                  <p className="px-2.5 py-1 mb-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 select-none">
                    {group.label}
                  </p>
                )}
                {collapsed && <div className="h-px bg-white/[0.06] mx-2 my-2" />}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onClose}
                        title={collapsed ? item.name : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-100",
                          collapsed ? "justify-center px-0 py-2.5 w-full" : "px-2.5 py-2",
                          isActive
                            ? "bg-[#C1BC7A]/15 text-[#C1BC7A]"
                            : "text-white/50 hover:text-white/90 hover:bg-white/[0.06]"
                        )}
                      >
                        <item.icon className={cn("shrink-0", collapsed ? "h-[18px] w-[18px]" : "h-4 w-4")} />
                        {!collapsed && <span className="truncate">{item.name}</span>}
                        {!collapsed && isActive && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#C1BC7A] shrink-0" />
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-white/[0.06] p-2 space-y-1">
          {/* Controls row */}
          <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between px-1")}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/40 hover:text-white/80 hover:bg-white/[0.06]"
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
              className="h-7 w-7 text-white/40 hover:text-white/80 hover:bg-white/[0.06] hidden lg:flex"
              onClick={onToggleCollapse}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5" />
                : <ChevronLeft className="h-3.5 w-3.5" />
              }
            </Button>
          </div>

          {/* User card */}
          <div className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 bg-white/[0.04] border border-white/[0.06]",
            collapsed && "justify-center px-0 border-0 bg-transparent"
          )}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C1BC7A]/20 text-[#C1BC7A] text-[11px] font-bold border border-[#C1BC7A]/30">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white/90 leading-none truncate">{user.nome.split(" ")[0]}</p>
                <p className="text-[10px] text-white/40 mt-0.5 truncate">{ROLE_LABELS[user.role] ?? user.role}</p>
              </div>
            )}
            {!collapsed && (
              <form action={logout}>
                <button
                  type="submit"
                  title="Sair"
                  className="h-6 w-6 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
