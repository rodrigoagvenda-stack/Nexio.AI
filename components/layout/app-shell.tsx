"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import type { Profile } from "@/types/database.types"

interface AppShellProps {
  user: Profile
  children: React.ReactNode
}

export function AppShell({ user, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        user={user}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(v => !v)}
      />
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ${collapsed ? "lg:pl-[60px]" : "lg:pl-56"}`}
      >
        <div data-header>
          <Header user={user} onMenuOpen={() => setSidebarOpen(true)} />
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
