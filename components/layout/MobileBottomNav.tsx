'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Users, Phone, Target, Settings } from 'lucide-react';

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/crm', label: 'CRM', icon: Users },
    { href: '/atendimento', label: 'Chat', icon: Phone },
    { href: '/lead-pro', label: 'PRO', icon: Target },
    { href: '/configuracoes', label: 'Mais', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <div className="bg-background/80 backdrop-blur-xl border border-border rounded-full px-6 py-3 shadow-2xl">
        <div className="flex items-center gap-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-1 transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {isActive && (
                  <div className="absolute -inset-3 bg-primary/10 rounded-full blur-sm" />
                )}
                <div className={`relative p-2 rounded-full transition-all ${
                  isActive ? 'bg-primary text-primary-foreground' : ''
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
