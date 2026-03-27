"use client"

import { usePathname } from "next/navigation"
import type { Profile } from "@/types/database.types"
import { LogoutButton } from "@/components/auth/logout-button"
import { Menu, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  user: Profile
  onMenuOpen: () => void
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  tesoureiro: "Tesoureiro",
  secretaria: "Secretaria",
  lider_ministerio: "Líder de Ministério",
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/membros": "Membros",
  "/escalas": "Escalas",
  "/financeiro": "Financeiro",
  "/eventos": "Eventos",
  "/frequencia": "Frequência",
  "/ministerios": "Ministérios",
  "/pedidos-oracao": "Pedidos de Oração",
  "/comunicacao": "Comunicação",
  "/igrejas": "Igrejas",
  "/configuracoes": "Configurações",
}

function getPageTitle(pathname: string): string {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname]
  // Match by prefix (e.g. /escalas/123 → "Escalas")
  const segment = "/" + pathname.split("/")[1]
  return pageTitles[segment] ?? ""
}

export function Header({ user, onMenuOpen }: HeaderProps) {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)
  const initials = user.nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 shadow-sm">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={onMenuOpen}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Abrir menu</span>
      </Button>

      {/* Page title */}
      {pageTitle && (
        <h1 className="text-sm font-semibold text-foreground tracking-tight hidden sm:block">
          {pageTitle}
        </h1>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        {/* Notification bell — visual only */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* User info */}
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="text-right">
            <p className="text-sm font-medium leading-none text-foreground">{user.nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{roleLabels[user.role]}</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none ring-2 ring-primary/20">
            {initials}
          </div>
        </div>

        {/* Mobile: avatar only */}
        <div className="flex sm:hidden h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold select-none">
          {initials}
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border mx-1" />

        {/* Logout icon-only button with native tooltip */}
        <LogoutButton iconOnly />
      </div>
    </header>
  )
}
