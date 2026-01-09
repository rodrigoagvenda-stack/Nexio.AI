"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Profile } from "@/types/database.types"
import {
  Home,
  Users,
  Church,
  Calendar,
  DollarSign,
  UserCheck,
  CalendarDays,
  MessageSquare,
  Heart,
  Settings,
} from "lucide-react"

interface SidebarProps {
  user: Profile
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, roles: ["admin", "pastor", "tesoureiro", "secretaria", "lider_ministerio"] },
  { name: "Membros", href: "/membros", icon: Users, roles: ["admin", "pastor", "secretaria", "lider_ministerio"] },
  { name: "Igrejas", href: "/igrejas", icon: Church, roles: ["admin", "pastor"] },
  { name: "Ministérios", href: "/ministerios", icon: Users, roles: ["admin", "pastor", "lider_ministerio"] },
  { name: "Escalas", href: "/escalas", icon: Calendar, roles: ["admin", "pastor", "secretaria"] },
  { name: "Frequência", href: "/frequencia", icon: UserCheck, roles: ["admin", "pastor", "secretaria"] },
  { name: "Financeiro", href: "/financeiro", icon: DollarSign, roles: ["admin", "pastor", "tesoureiro"] },
  { name: "Eventos", href: "/eventos", icon: CalendarDays, roles: ["admin", "pastor", "secretaria"] },
  { name: "Comunicação", href: "/comunicacao", icon: MessageSquare, roles: ["admin", "pastor", "secretaria"] },
  { name: "Pedidos de Oração", href: "/pedidos", icon: Heart, roles: ["admin", "pastor", "lider_ministerio"] },
]

const adminNavigation = [
  { name: "Configurações", href: "/configuracoes", icon: Settings, roles: ["admin", "pastor"] },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const canAccess = (roles: string[]) => {
    return roles.includes(user.role)
  }

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-gray-200 px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center border-b border-gray-200">
          <span className="text-2xl font-bold text-primary">⛪ Igreja</span>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.filter(item => canAccess(item.roles)).map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors",
                          isActive
                            ? "bg-primary text-white"
                            : "text-gray-700 hover:text-primary hover:bg-gray-50"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-6 w-6 shrink-0",
                            isActive ? "text-white" : "text-gray-400 group-hover:text-primary"
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
            <li className="mt-auto">
              <ul role="list" className="-mx-2 space-y-1">
                {adminNavigation.filter(item => canAccess(item.roles)).map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors",
                          isActive
                            ? "bg-primary text-white"
                            : "text-gray-700 hover:text-primary hover:bg-gray-50"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-6 w-6 shrink-0",
                            isActive ? "text-white" : "text-gray-400 group-hover:text-primary"
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
