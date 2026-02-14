'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useState, useEffect, memo } from 'react';
import {
  ChartLine,
  ChartPie,
  MessageCircleMore,
  UserRoundCog,
  Info,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Bot,
  Bolt,
  Table2,
  Kanban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';

interface SidebarProps {
  isAdmin?: boolean;
  companyName?: string;
  companyEmail?: string;
  companyImage?: string;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const links: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: ChartLine },
  {
    href: '/crm',
    label: 'CRM',
    icon: ChartPie,
    children: [
      { href: '/crm?view=table', label: 'Planilha', icon: Table2 },
      { href: '/crm?view=kanban', label: 'Kanban', icon: Kanban },
    ],
  },
  { href: '/atendimento', label: 'Atendimento', icon: MessageCircleMore },
  { href: '/prospect', label: 'Orbit', icon: Bot },
  { href: '/membros', label: 'Membros', icon: UserRoundCog },
  { href: '/ajuda', label: 'Ajuda', icon: Info },
  { href: '/configuracao', label: 'Configuração', icon: Bolt },
];

export const Sidebar = memo(function Sidebar({
  isAdmin = false,
  companyName,
  companyEmail,
  companyImage,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(
    pathname === '/crm' || pathname.startsWith('/crm/')
  );
  const [currentView, setCurrentView] = useState('table');

  // 🚀 Performance: Atualizar view apenas quando pathname ou search params mudam
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCurrentView(params.get('view') || 'table');
  }, [pathname]); // Reage apenas a mudanças reais de navegação

  const allLinks: NavLink[] = [
    ...links,
    ...(isAdmin
      ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, badge: 'ADMIN' }]
      : []),
  ];

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast({
        title: 'Logout realizado com sucesso',
        variant: 'default',
      });
      router.push('/login');
    } catch {
      toast({
        title: 'Erro ao fazer logout',
        variant: 'destructive',
      });
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <aside
        className={cn(
          'hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col bg-card border-r border-border transition-[width] duration-200',
          isCollapsed ? 'md:w-20' : 'md:w-64'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-6">
          {!isCollapsed && (
            <h1 className="text-xl">
              <span className="font-normal text-foreground">nexio</span>
              <span className="text-primary font-bold">.</span>
              <span className="font-normal text-foreground">ai</span>
            </h1>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 pt-4 space-y-1 overflow-y-auto">
          {allLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
            const hasChildren = link.children && link.children.length > 0;

            if (hasChildren) {
              const isCrmActive = pathname === '/crm' || pathname.startsWith('/crm');

              return (
                <div key={link.href}>
                  {/* CRM parent button */}
                  <button
                    onClick={() => {
                      if (isCollapsed) {
                        router.push(link.href);
                        return;
                      }
                      setCrmExpanded(!crmExpanded);
                    }}
                    className={cn(
                      'w-full group flex items-center gap-3 px-3 py-3 rounded-lg transition-colors duration-100',
                      isCrmActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                      isCollapsed && 'justify-center px-2'
                    )}
                    title={isCollapsed ? link.label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="text-sm flex-1 text-left">{link.label}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform duration-200',
                            crmExpanded && 'rotate-180'
                          )}
                        />
                      </>
                    )}
                  </button>

                  {/* Sub-items */}
                  {!isCollapsed && crmExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-border pl-4">
                      {link.children!.map((child) => {
                        const ChildIcon = child.icon;
                        const childView = child.href.includes('view=kanban') ? 'kanban' : 'table';
                        const isChildActive = pathname === '/crm' && currentView === childView;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            prefetch={true}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-100',
                              isChildActive
                                ? 'bg-accent text-accent-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            )}
                          >
                            <ChildIcon className="h-4 w-4 flex-shrink-0" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className={cn(
                  'w-full group flex items-center gap-3 px-3 py-3 rounded-lg transition-colors duration-100',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                  isCollapsed && 'justify-center px-2'
                )}
                title={isCollapsed ? link.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="text-sm flex-1 text-left">{link.label}</span>
                    {link.badge && (
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium border border-primary/30">
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
        <div className="p-4 border-t border-border">
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
                <span className="text-xs font-bold text-primary-foreground">
                  {companyName?.charAt(0)?.toUpperCase() || 'E'}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{companyName || 'Empresa'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {companyEmail || 'empresa@nexio.ai'}
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
                'flex-1 justify-start text-muted-foreground hover:text-foreground hover:bg-accent/50',
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
            className="w-full mt-2 text-muted-foreground hover:text-foreground hover:bg-accent/50"
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
      <div className={cn('hidden md:block', isCollapsed ? 'md:w-20' : 'md:w-64')} />
    </>
  );
});
