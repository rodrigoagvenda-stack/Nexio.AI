"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  user: Profile
  mobileOpen: boolean
  onClose: () => void
}

const navigation = [
  { name: "Dashboard",         href: "/dashboard",  icon: LayoutDashboard, roles: ["admin","pastor","tesoureiro","secretaria","lider_ministerio"] },
  { name: "Membros",           href: "/membros",     icon: Users,           roles: ["admin","pastor","secretaria","lider_ministerio"] },
  { name: "Igrejas",           href: "/igrejas",     icon: Building2,       roles: ["admin","pastor"] },
  { name: "Ministérios",       href: "/ministerios", icon: Layers,          roles: ["admin","pastor","lider_ministerio"] },
  { name: "Escalas",           href: "/escalas",     icon: Calendar,        roles: ["admin","pastor","secretaria"] },
  { name: "Frequência",        href: "/frequencia",  icon: UserCheck,       roles: ["admin","pastor","secretaria"] },
  { name: "Financeiro",        href: "/financeiro",  icon: Wallet,          roles: ["admin","pastor","tesoureiro"] },
  { name: "Eventos",           href: "/eventos",     icon: CalendarDays,    roles: ["admin","pastor","secretaria"] },
  { name: "Comunicação",       href: "/comunicacao", icon: MessageSquare,   roles: ["admin","pastor","secretaria"] },
  { name: "Pedidos de Oração", href: "/pedidos",     icon: HandHeart,       roles: ["admin","pastor","lider_ministerio"] },
]

const adminNavigation = [
  { name: "Configurações", href: "/configuracoes", icon: Settings, roles: ["admin","pastor"] },
]

export function Sidebar({ user, mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const canAccess = (roles: string[]) => roles.includes(user.role)
  const initials = user.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-background border-r border-border",
        "transition-transform duration-300 ease-in-out",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
            <Cross className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold">IPVB Sistema</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {navigation.filter(item => canAccess(item.roles)).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          )
        })}

        {adminNavigation.filter(item => canAccess(item.roles)).length > 0 && (
          <>
            <div className="pt-2 pb-1 px-3">
              <div className="border-t border-border" />
            </div>
            {adminNavigation.filter(item => canAccess(item.roles)).map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="shrink-0 p-3 border-t border-border">
        <div className="flex items-center gap-3 rounded-md px-3 py-2 bg-muted">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate">{user.nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize truncate">{user.role}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
