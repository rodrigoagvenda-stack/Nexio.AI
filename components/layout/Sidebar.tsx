'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  PieChart,
  MessageCircle,
  UserCog,
  Info,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Bot,
  Settings,
  Table2,
  Kanban,
  FileText,
  Megaphone,
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
  planName?: string;
  hasBriefing?: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

interface NavSection {
  label: string;
  links: NavLink[];
}

const navSections: NavSection[] = [
  {
    label: 'Principal',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: TrendingUp },
    ],
  },
  {
    label: 'Ferramentas',
    links: [
      {
        href: '/crm',
        label: 'CRM',
        icon: PieChart,
        children: [
          { href: '/crm?view=table', label: 'Planilha', icon: Table2 },
          { href: '/crm?view=kanban', label: 'Kanban', icon: Kanban },
        ],
      },
      { href: '/atendimento', label: 'Atendimento', icon: MessageCircle },
      { href: '/prospect', label: 'Orbit', icon: Bot },
      { href: '/outbound', label: 'Outbound', icon: Megaphone },
    ],
  },
  {
    label: 'Gestão',
    links: [
      { href: '/membros', label: 'Membros', icon: UserCog },
    ],
  },
  {
    label: 'Sistema',
    links: [
      { href: '/ajuda', label: 'Ajuda', icon: Info },
      { href: '/configuracoes', label: 'Configuração', icon: Settings },
    ],
  },
];

export const Sidebar = memo(function Sidebar({
  isAdmin = false,
  companyName,
  companyEmail,
  companyImage,
  planName,
  hasBriefing = false,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [crmExpanded, setCrmExpanded] = useState(false);

  // 🚀 Performance: Computar se está na rota CRM
  const isCrmRoute = useMemo(() =>
    pathname === '/crm' || pathname.startsWith('/crm/'),
    [pathname]
  );

  // 🚀 Obter view atual da URL usando useSearchParams
  const currentView = useMemo(() => {
    if (!isCrmRoute) return 'table';
    const view = searchParams.get('view');
    return view === 'kanban' ? 'kanban' : 'table';
  }, [isCrmRoute, searchParams]);

  // 🚀 Auto-expandir CRM quando estiver na rota
  useEffect(() => {
    if (isCrmRoute) {
      setCrmExpanded(true);
    }
  }, [isCrmRoute]);

  // 🚀 Performance: Memoizar seções de navegação
  const allSections = useMemo<NavSection[]>(() => {
    const planNameUpper = planName?.toUpperCase() || '';
    const hasOrbitAccess = planNameUpper.includes('GROWTH') || planNameUpper.includes('ADS');

    const sections = navSections.map(section => ({
      ...section,
      links: section.links.filter(link => {
        if (link.href === '/prospect' && !hasOrbitAccess) return false;
        return true;
      }),
    })).filter(section => section.links.length > 0);

    // Adicionar Briefing e Admin na seção Gestão / Sistema
    return sections.map(section => {
      if (section.label === 'Gestão') {
        return {
          ...section,
          links: [
            ...section.links,
            ...(hasBriefing ? [{ href: '/briefing', label: 'Briefing', icon: FileText }] : []),
          ],
        };
      }
      if (section.label === 'Sistema') {
        return {
          ...section,
          links: [
            ...section.links,
            ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck, badge: 'ADMIN' }] : []),
          ],
        };
      }
      return section;
    });
  }, [isAdmin, planName, hasBriefing]);

  // 🚀 Performance: Memoizar função de logout
  const handleLogout = useCallback(async () => {
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
  }, [router]);

  return (
    <>
      <aside
        className={cn(
          'hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col bg-card border-r border-border transition-[width] duration-200',
          isCollapsed ? 'md:w-20' : 'md:w-56'
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
        <nav className="flex-1 px-4 pt-4 overflow-y-auto space-y-4">
          {allSections.map((section) => (
            <div key={section.label}>
              {/* Section label */}
              {!isCollapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
                  {section.label}
                </p>
              )}
              {isCollapsed && (
                <div className="mx-auto w-6 border-t border-border/50 mb-1" />
              )}

              <div className="space-y-0.5">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                  const hasChildren = link.children && link.children.length > 0;

                  if (hasChildren) {
                    const isCrmActive = pathname === '/crm' || pathname.startsWith('/crm');

                    return (
                      <div key={link.href}>
                        <button
                          onClick={() => {
                            if (isCollapsed) {
                              router.push(link.href);
                            } else {
                              setCrmExpanded(!crmExpanded);
                            }
                          }}
                          className={cn(
                            'w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100',
                            isCrmActive
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                            isCollapsed && 'justify-center px-2'
                          )}
                          title={isCollapsed ? link.label : undefined}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          {!isCollapsed && (
                            <>
                              <span className="text-sm flex-1 text-left">{link.label}</span>
                              <ChevronDown
                                className={cn(
                                  'h-3.5 w-3.5 transition-transform duration-200',
                                  crmExpanded && 'rotate-180'
                                )}
                              />
                            </>
                          )}
                        </button>

                        {!isCollapsed && crmExpanded && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
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
                                  <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />
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
                        'w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                        isCollapsed && 'justify-center px-2'
                      )}
                      title={isCollapsed ? link.label : undefined}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      {!isCollapsed && (
                        <>
                          <span className="text-sm flex-1 text-left">{link.label}</span>
                          {link.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium border border-primary/30">
                              {link.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
      <div className={cn('hidden md:block', isCollapsed ? 'md:w-20' : 'md:w-56')} />
    </>
  );
});
