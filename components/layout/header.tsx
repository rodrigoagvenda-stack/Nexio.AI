"use client"

import type { Profile } from "@/types/database.types"
import { LogoutButton } from "@/components/auth/logout-button"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/utils"

interface HeaderProps {
  user: Profile
}

const roleLabels = {
  admin: "Administrador",
  pastor: "Pastor",
  tesoureiro: "Tesoureiro",
  secretaria: "Secretaria",
  lider_ministerio: "Líder de Ministério",
}

export function Header({ user }: HeaderProps) {
  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Sistema de Gestão para Igrejas
          </h1>
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notificações */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-600 text-xs text-white flex items-center justify-center">
              3
            </span>
          </Button>

          {/* Separador */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />

          {/* Perfil do usuário */}
          <div className="flex items-center gap-x-4">
            <div className="hidden lg:block lg:text-right">
              <p className="text-sm font-semibold text-gray-900">{user.nome}</p>
              <p className="text-xs text-gray-500">{roleLabels[user.role]}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
              {getInitials(user.nome)}
            </div>
          </div>

          {/* Separador */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />

          {/* Logout */}
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
