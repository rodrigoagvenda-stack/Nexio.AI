'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, MessageCircle, Bot, Megaphone,
  PieChart, Table2, Kanban, MoreHorizontal, X,
  Users, Info, Settings, Zap,
} from 'lucide-react';

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [crmOpen, setCrmOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isCrm = pathname?.startsWith('/crm');
  const isMore = pathname?.startsWith('/membros') || pathname?.startsWith('/ajuda') || pathname?.startsWith('/configuracoes');

  const mainItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/atendimento', label: 'Chat', icon: MessageCircle },
    { href: '/prospect', label: 'Orbit', icon: Bot },
    { href: '/outbound', label: 'Automação', icon: Megaphone },
  ];

  const crmItems = [
    { href: '/crm?view=table', label: 'Planilha', icon: Table2 },
    { href: '/crm?view=kanban', label: 'Kanban', icon: Kanban },
  ];

  const moreItems = [
    { href: '/membros', label: 'Membros', icon: Users },
    { href: '/ajuda', label: 'Ajuda', icon: Info },
    { href: '/configuracoes', label: 'Configuração', icon: Settings },
  ];

  function navigate(href: string) {
    setCrmOpen(false);
    setMoreOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* Backdrop */}
      {(crmOpen || moreOpen) && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => { setCrmOpen(false); setMoreOpen(false); }}
        />
      )}

      {/* CRM submenu */}
      {crmOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 md:hidden bg-card border border-border rounded-2xl shadow-2xl p-4 flex gap-6 min-w-[200px] justify-center">
          {crmItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === '/crm' && item.href.includes(pathname);
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* More submenu */}
      {moreOpen && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 md:hidden bg-card border border-border rounded-2xl shadow-2xl p-4 flex gap-4 min-w-[240px] justify-center">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname?.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-[15px] left-1/2 -translate-x-1/2 z-50 md:hidden">
        <div className="bg-card/90 backdrop-blur-xl border border-border rounded-full px-3 py-2 shadow-2xl">
          <div className="flex items-center gap-1">

            {/* CRM button */}
            <button
              onClick={() => { setMoreOpen(false); setCrmOpen(!crmOpen); }}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-full transition-all ${isCrm || crmOpen ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {(isCrm || crmOpen) && <div className="absolute inset-0 bg-primary/10 rounded-full" />}
              <div className={`relative p-1.5 rounded-full ${isCrm || crmOpen ? 'bg-primary text-primary-foreground' : ''}`}>
                <PieChart className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">CRM</span>
            </button>

            {/* Main items */}
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-full transition-all ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {isActive && <div className="absolute inset-0 bg-primary/10 rounded-full" />}
                  <div className={`relative p-1.5 rounded-full ${isActive ? 'bg-primary text-primary-foreground' : ''}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}

            {/* More button */}
            <button
              onClick={() => { setCrmOpen(false); setMoreOpen(!moreOpen); }}
              className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-full transition-all ${isMore || moreOpen ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {(isMore || moreOpen) && <div className="absolute inset-0 bg-primary/10 rounded-full" />}
              <div className={`relative p-1.5 rounded-full ${isMore || moreOpen ? 'bg-primary text-primary-foreground' : ''}`}>
                {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
              </div>
              <span className="text-[10px] font-medium">Mais</span>
            </button>

          </div>
        </div>
      </nav>
    </>
  );
}
