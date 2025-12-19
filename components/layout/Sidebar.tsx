'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  LayoutDashboard,
  Users,
  MapPin,
  MessageSquare,
  Target,
  Settings,
  UserPlus,
} from 'lucide-react';

interface SidebarProps {
  hasVendAgro?: boolean;
}

export function Sidebar({ hasVendAgro = false }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/crm',
      label: 'CRM',
      icon: Users,
    },
    {
      href: '/captacao',
      label: 'Captação',
      icon: MapPin,
    },
    {
      href: '/atendimento',
      label: 'Atendimento',
      icon: MessageSquare,
    },
    ...(hasVendAgro
      ? [
          {
            href: '/lead-pro',
            label: 'Lead PRO',
            icon: Target,
          },
        ]
      : []),
    {
      href: '/membros',
      label: 'Membros',
      icon: UserPlus,
    },
    {
      href: '/configuracoes',
      label: 'Configurações',
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50 bg-card border-r border-border">
      <div className="flex items-center justify-center h-16 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">vend.AI</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{link.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Quem já queimou os barcos, entra por aqui. 🚀
        </p>
      </div>
    </aside>
  );
}
