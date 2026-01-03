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
          'hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col bg-card border-r border-border transition-all duration-300',
          isCollapsed ? 'md:w-20' : 'md:w-72'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-20 px-6 border-b border-border/50">
          {!isCollapsed && (
            <h1 className="text-2xl">
              <span className="font-normal">vend</span>
              <span className="text-primary font-bold">.</span>
              <span className="font-bold">AI</span>
            </h1>
          )}
        </div>

        {/* Menu Label */}
        {!isCollapsed && (
          <div className="px-6 pt-6 pb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Menu
            </span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:bg-accent/50',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <div
                  className={cn(
                    'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                    isActive
                      ? 'bg-primary-foreground/20'
                      : 'bg-muted/50 group-hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {!isCollapsed && (
                  <>
                    <span className="font-medium text-sm flex-1">{link.label}</span>
                    {link.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">
                        {link.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Company Profile */}
        <div className="p-4 border-t border-border/50">
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl bg-accent/30',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center overflow-hidden">
              {companyImage ? (
                <img src={companyImage} alt={companyName || 'Empresa'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">
                  {companyName?.charAt(0)?.toUpperCase() || 'E'}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{companyName || 'Empresa'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {companyEmail || 'empresa@vend.ai'}
                </p>
              </div>
            )}
          </div>

          {/* Theme and Actions */}
          <div className={cn('flex gap-2 mt-2', isCollapsed && 'flex-col')}>
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn(
                'flex-1 justify-start text-muted-foreground hover:text-foreground',
                isCollapsed && 'justify-center px-2'
              )}
              size={isCollapsed ? 'icon' : 'default'}
              title={isCollapsed ? 'Sair' : undefined}
            >
              <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
              {!isCollapsed && (isLoggingOut ? 'Saindo...' : 'Sair')}
            </Button>
          </div>

          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full mt-2"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      {/* Spacer for content */}
      <div className={cn('hidden md:block', isCollapsed ? 'md:w-20' : 'md:w-72')} />
    </>
  );
}
