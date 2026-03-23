"use client"

import type { Profile } from "@/types/database.types"
import { LogoutButton } from "@/components/auth/logout-button"
import { Menu } from "lucide-react"
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

export function Header({ user, onMenuOpen }: HeaderProps) {
  const initials = user.nome.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background px-4 sm:px-6">
      {/* Mobile menu button */}
      <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={onMenuOpen}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <p className="text-sm font-medium leading-none">{user.nome}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{roleLabels[user.role]}</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
          {initials}
        </div>
        <div className="h-5 w-px bg-border" />
        <LogoutButton />
      </div>
    </header>
  )
}
