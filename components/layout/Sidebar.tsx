'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
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
  LogOut,
  Bot,
  Settings,
  Table2,
  Kanban,
  FileText,
  Megaphone,
  Clock,
  CalendarClock,
  BarChart2,
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
  brandLogoUrl?: string | null;
  userRole?: string;
  trialEnabled?: boolean;
  tokensUsed?: number;
  tokensLimit?: number;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  exact?: boolean;
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
      {
        href: '/automacoes',
        label: 'Automações',
        icon: Megaphone,
        children: [
          { href: '/configuracoes/sdr', label: 'Agente SDR', icon: Bot },
          { href: '/configuracoes/follow?tab=follow_geral', label: 'Follow-up', icon: Clock },
          { href: '/configuracoes/follow?tab=anti_noshow', label: 'Anti-Noshow', icon: CalendarClock },
          { href: '/configuracoes/follow?tab=remarketing', label: 'Remarketing', icon: Megaphone },
          { href: '/configuracoes/trial', label: 'Trial SaaS', icon: FileText },
          { href: '/configuracoes/metricas', label: 'Métricas', icon: BarChart2 },
        ],
      },
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
      { href: '/configuracoes', label: 'Configuração', icon: Settings, exact: true },
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
  brandLogoUrl,
  userRole,
  trialEnabled = false,
  tokensUsed = 0,
  tokensLimit = 0,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(saved || system);

    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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

  // 🚀 Performance: Memoizar seções de navegação
  const allSections = useMemo<NavSection[]>(() => {
    const isCloser = userRole === 'closer';
    const isSdr = userRole === 'sdr';
    const isSdrCloser = userRole === 'sdr_closer';

    const sections = navSections.map(section => ({
      ...section,
      links: section.links.map(link => {
        if (link.children) {
          return {
            ...link,
            children: link.children.filter(child => {
              if (child.href.includes('/configuracoes/trial') && !trialEnabled) return false;
              return true;
            }),
          };
        }
        return link;
      }).filter(link => {
        // Closer puro: sem Automações, Membros
        if (isCloser && (link.href === '/automacoes' || link.href === '/membros')) return false;
        // SDR e SDR Closer: sem Membros
        if ((isSdr || isSdrCloser) && link.href === '/membros') return false;
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
  }, [isAdmin, userRole, hasBriefing, trialEnabled]);

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
        {/* Logo + collapse toggle */}
        <div className={cn('flex items-center h-14 border-b border-border/50', isCollapsed ? 'justify-center px-3' : 'px-4 gap-2')}>
          {isCollapsed ? (
            <button onClick={() => setIsCollapsed(false)} className="p-1 rounded-md hover:bg-accent/50 transition-colors" title="Expandir">
              <ZaapliLogo variant="icon" iconSize={26} />
            </button>
          ) : (
            <>
              <ZaapliLogo variant="full" iconSize={26} className="flex-1 min-w-0" />
              <button
                onClick={() => setIsCollapsed(true)}
                className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                title="Recolher"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-3 space-y-3 overflow-y-auto overflow-x-visible">
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
                  const isActive = link.exact ? pathname === link.href : (pathname === link.href || pathname.startsWith(link.href + '/'));
                  const hasChildren = link.children && link.children.length > 0;

                  if (hasChildren) {
                    const isParentActive = link.children?.some(c => {
                      const base = c.href.split('?')[0];
                      return pathname === base || pathname.startsWith(base + '/');
                    }) || pathname === link.href || pathname.startsWith(link.href + '/');

                    return (
                      <div key={link.href} className="relative group/flyout">
                        {/* parent row */}
                        <div
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100 select-none',
                            isParentActive
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
                              <ChevronRight className="h-3 w-3 opacity-40 group-hover/flyout:opacity-100 transition-opacity" />
                            </>
                          )}
                        </div>

                        {/* flyout panel */}
                        <div className="absolute left-full top-0 ml-2 z-[70] pointer-events-none opacity-0 -translate-x-1 group-hover/flyout:opacity-100 group-hover/flyout:translate-x-0 group-hover/flyout:pointer-events-auto transition-all duration-150">
                          <div className="bg-card border border-border rounded-xl shadow-xl p-1.5 min-w-[180px]">
                            <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest select-none">
                              {link.label}
                            </p>
                            {link.children!.map((child) => {
                              const ChildIcon = child.icon;
                              const childBase = child.href.split('?')[0];
                              const isCrmChild = link.href === '/crm';
                              let isChildActive: boolean;
                              if (isCrmChild) {
                                const childView = child.href.includes('view=kanban') ? 'kanban' : 'table';
                                isChildActive = pathname === '/crm' && currentView === childView;
                              } else if (child.href.includes('?')) {
                                const childTab = new URLSearchParams(child.href.split('?')[1]).get('tab');
                                isChildActive = (pathname === childBase || pathname.startsWith(childBase + '/')) && searchParams.get('tab') === childTab;
                              } else {
                                isChildActive = pathname === childBase || pathname.startsWith(childBase + '/');
                              }
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  prefetch={true}
                                  className={cn(
                                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-100',
                                    isChildActive
                                      ? 'bg-accent text-accent-foreground font-medium'
                                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                  )}
                                >
                                  <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span>{child.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
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
        <div className="p-4 border-t border-border space-y-3">

          {/* Token usage card — aurora gradient border */}
          {!isCollapsed && tokensLimit > 0 && (() => {
            const pct = Math.min(100, Math.round((tokensUsed / tokensLimit) * 100));
            const isCritical = pct >= 95;
            const isWarning = pct >= 80;
            const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#15803d';
            return (
              <div className="p-[1px] rounded-xl animate-aurora shadow-md shadow-primary/20">
                <div className="rounded-[11px] bg-card p-3 space-y-2.5">
                  {/* plan badge + label */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-foreground leading-none tracking-tight">Tokens mensais</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{planName || 'Plano atual'}</p>
                    </div>
                    <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-primary/30 text-primary bg-primary/10 uppercase tracking-wider">
                      {isCritical ? 'Crítico' : isWarning ? 'Atenção' : 'OK'}
                    </span>
                  </div>

                  {/* numbers */}
                  <div className="flex items-baseline gap-1">
                    <span className="text-[13px] font-bold text-foreground tabular-nums">{tokensUsed.toLocaleString('pt-BR')}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">/ {tokensLimit.toLocaleString('pt-BR')}</span>
                  </div>

                  {/* progress bar */}
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{pct}% utilizado</p>
                  </div>

                  {/* upgrade button */}
                  <Link
                    href="/planos"
                    className="flex items-center justify-center gap-1 w-full h-7 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Fazer upgrade
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })()}

          {/* Avatar + name */}
          <div
            className={cn(
              'flex items-center gap-3 px-2 py-2 rounded-xl bg-accent/30',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center overflow-hidden">
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
                  {companyEmail || 'empresa@zaapply.com.br'}
                </p>
              </div>
            )}
          </div>

          {/* Theme toggle + logout */}
          <div className={cn('flex items-center gap-2', isCollapsed && 'flex-col')}>
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

        </div>
      </aside>

      {/* Spacer for content */}
      <div className={cn('hidden md:block', isCollapsed ? 'md:w-20' : 'md:w-56')} />
    </>
  );
});
