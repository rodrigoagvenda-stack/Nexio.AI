'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Target,
  UserPlus,
  HelpCircle,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

interface SidebarProps {
  hasVendAgro?: boolean;
  isAdmin?: boolean;
  companyName?: string;
  companyEmail?: string;
  companyImage?: string;
}

export function Sidebar({
  hasVendAgro = false,
  isAdmin = false,
  companyName,
  companyEmail,
  companyImage,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
      href: '/atendimento',
      label: 'Atendimento',
      icon: MessageSquare,
    },
    {
      href: '/lead-pro',
      label: 'Lead PRO',
      icon: Target,
      badge: hasVendAgro ? undefined : 'PRO',
    },
    {
      href: '/prospect',
      label: 'prospect.AI',
      icon: Sparkles,
    },
    {
      href: '/membros',
      label: 'Membros',
      icon: UserPlus,
    },
    {
      href: '/ajuda',
      label: 'Ajuda',
      icon: HelpCircle,
    },
    ...(isAdmin
      ? [
          {
            href: '/admin',
            label: 'Admin',
            icon: Shield,
            badge: 'ADMIN' as const,
          },
        ]
      : []),
  ];

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso');
      router.push('/login');
    } catch (error) {
      toast.error('Erro ao fazer logout');
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col bg-background border-r border-border/40 transition-all duration-300',
          isCollapsed ? 'md:w-20' : 'md:w-64'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-6">
          {!isCollapsed && (
            <h1 className="text-xl font-semibold">
              vend<span className="text-primary">.</span>AI
            </h1>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-primary')} />
                {!isCollapsed && (
                  <>
                    <span className="text-sm flex-1">{link.label}</span>
                    {link.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                        {link.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-border/40 space-y-2">
          {/* Theme and Logout */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn(
                'flex-1 justify-start text-muted-foreground hover:text-foreground h-9',
                isCollapsed && 'justify-center px-2'
              )}
              size="sm"
              title={isCollapsed ? 'Sair' : undefined}
            >
              <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
              {!isCollapsed && (isLoggingOut ? 'Saindo...' : 'Sair')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Spacer for content */}
      <div className={cn('hidden md:block', isCollapsed ? 'md:w-20' : 'md:w-64')} />
    </>
  );
}
