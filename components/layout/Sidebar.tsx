'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  CalendarDays,
  Sparkles,
  LifeBuoy,
  Ticket,
  BookOpen,
  Zap,
  FlaskConical,
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
  companyId?: number;
  planName?: string;
  hasBriefing?: boolean;
  brandLogoUrl?: string | null;
  userRole?: string;
  trialEnabled?: boolean;
  trialEndsAt?: string | null;
  isTrial?: boolean;
  tokensUsed?: number;
  tokensLimit?: number;
}

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

interface NavChild {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  unreadCount?: number;
  exact?: boolean;
  children?: NavChild[];
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
          { href: '/configuracoes/follow', label: 'Canvas', icon: Megaphone },
          { href: '/configuracoes/agenda', label: 'Agenda', icon: CalendarDays },
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
      { href: '/novidades', label: 'Novidades', icon: Sparkles },
      {
        href: '/ajuda',
        label: 'Ajuda',
        icon: LifeBuoy,
        children: [
          { href: '/ajuda', label: 'Documentação', icon: BookOpen },
          { href: '/suporte', label: 'Tickets', icon: Ticket },
        ],
      },
      { href: '/configuracoes', label: 'Configuração', icon: Settings, exact: true },
    ],
  },
];

// ─── Flyout portal ────────────────────────────────────────────────────────────
interface FlyoutState {
  link: NavLink;
  top: number;
  left: number;
}

const TRIAL_BLOCKED_PATHS: string[] = []; // trial = acesso completo

function FlyoutPanel({
  state,
  pathname,
  searchParams,
  currentView,
  isTrial,
  onClose,
  onKeepOpen,
}: {
  state: FlyoutState;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
  currentView: string;
  isTrial: boolean;
  onClose: () => void;
  onKeepOpen: () => void;
}) {
  const { link, top, left } = state;
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top, left, zIndex: 9999 }}
      onMouseEnter={onKeepOpen}
      onMouseLeave={onClose}
      className="bg-card border border-border rounded-xl shadow-2xl p-1.5 min-w-[190px] animate-in fade-in slide-in-from-left-1 duration-150"
    >
      <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest select-none">
        {link.label}
      </p>
      {link.children!.map((child) => {
        const ChildIcon = child.icon;
        const childBase = child.href.split('?')[0];
        const isCrmChild = link.href === '/crm';
        const isBlocked = isTrial && TRIAL_BLOCKED_PATHS.some(p => child.href.startsWith(p));
        let isChildActive: boolean;
        if (isCrmChild) {
          const childView = child.href.includes('view=kanban') ? 'kanban' : 'table';
          isChildActive = pathname === '/crm' && currentView === childView;
        } else if (child.href.includes('?')) {
          const childTab = new URLSearchParams(child.href.split('?')[1]).get('tab');
          isChildActive =
            (pathname === childBase || pathname.startsWith(childBase + '/')) &&
            searchParams.get('tab') === childTab;
        } else {
          isChildActive = pathname === childBase || pathname.startsWith(childBase + '/');
        }
        if (isBlocked) {
          return (
            <button
              key={child.href}
              onClick={() => { onClose(); router.push('/configuracoes?tab=plano'); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-100 text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/30"
            >
              <ChildIcon className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{child.label}</span>
              <Zap className="h-3 w-3 ml-auto text-primary/60" />
            </button>
          );
        }
        return (
          <Link
            key={child.href}
            href={child.href}
            prefetch={true}
            onClick={onClose}
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
    </div>,
    document.body
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export const Sidebar = memo(function Sidebar({
  isAdmin = false,
  companyName,
  companyEmail,
  companyImage,
  companyId,
  planName,
  hasBriefing = false,
  brandLogoUrl,
  userRole,
  trialEnabled = false,
  trialEndsAt,
  isTrial = false,
  tokensUsed = 0,
  tokensLimit = 0,
}: SidebarProps) {
  const trialDaysLeft = useMemo(() => {
    if (!isTrial || !trialEndsAt) return null;
    const diff = new Date(trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [isTrial, trialEndsAt]);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const [hasUnseenChangelog, setHasUnseenChangelog] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const flyoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundRef = useRef<number>(0);

  // Subscription de mensagens inbound — contador + som
  useEffect(() => {
    if (!companyId) return;
    const supabase = createClient();
    const lastSeen = localStorage.getItem('atendimento_last_seen');
    const since = lastSeen ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // Conta mensagens não lidas desde a última visita
    supabase
      .from('mensagens_do_whatsapp')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('direcao', 'inbound')
      .gte('carimbo_de_data_e_hora', since)
      .then(({ count }) => setUnreadMsgCount(count ?? 0));

    // Realtime: incrementa e toca som a cada nova mensagem inbound
    const channel = supabase
      .channel(`sidebar_msgs_${companyId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens_do_whatsapp',
        filter: `company_id=eq.${companyId}`,
      }, (payload) => {
        if ((payload.new as any)?.direcao !== 'inbound') return;
        setUnreadMsgCount((c) => c + 1);
        const now = Date.now();
        if (now - lastSoundRef.current > 2000) {
          lastSoundRef.current = now;
          playNotifSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  // Zera contador ao entrar em /atendimento
  useEffect(() => {
    if (pathname === '/atendimento' || pathname?.startsWith('/atendimento/')) {
      setUnreadMsgCount(0);
      localStorage.setItem('atendimento_last_seen', new Date().toISOString());
    }
  }, [pathname]);

  useEffect(() => {
    const lastSeen = localStorage.getItem('zaapply_changelog_last_seen');
    if (!lastSeen) { setHasUnseenChangelog(true); return; }
    fetch('/api/changelog')
      .then(r => r.json())
      .then(d => {
        const changelogs: Array<{ published_at: string }> = d.changelogs ?? [];
        const hasNew = changelogs.some(c => new Date(c.published_at) > new Date(lastSeen));
        setHasUnseenChangelog(hasNew);
      })
      .catch(() => {});
  }, [pathname]);

  const openFlyout = useCallback((link: NavLink, el: HTMLElement) => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
    const rect = el.getBoundingClientRect();
    // sem gap: painel cola no item para o mouse não "cair no vazio"
    setFlyout({ link, top: rect.top, left: rect.right + 2 });
  }, []);

  const closeFlyout = useCallback(() => {
    // delay generoso para o mouse cruzar os 2px de gap
    flyoutTimeoutRef.current = setTimeout(() => setFlyout(null), 200);
  }, []);

  const keepFlyout = useCallback(() => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
  }, []);

  useEffect(() => () => {
    if (flyoutTimeoutRef.current) clearTimeout(flyoutTimeoutRef.current);
  }, []);

  // Auto-collapse on canvas, auto-expand when leaving
  const autoCollapsedRef = useRef(false);
  useEffect(() => {
    const isCanvas = pathname === '/configuracoes/follow' || pathname.startsWith('/configuracoes/follow/');
    if (isCanvas) {
      autoCollapsedRef.current = true;
      setIsCollapsed(true);
    } else if (autoCollapsedRef.current) {
      autoCollapsedRef.current = false;
      setIsCollapsed(false);
    }
  }, [pathname]);

  const isCrmRoute = useMemo(() =>
    pathname === '/crm' || pathname.startsWith('/crm/'),
    [pathname]
  );

  const currentView = useMemo(() => {
    if (!isCrmRoute) return 'table';
    const view = searchParams.get('view');
    return view === 'kanban' ? 'kanban' : 'table';
  }, [isCrmRoute, searchParams]);

  const allSections = useMemo<NavSection[]>(() => {
    const isCloser = userRole === 'closer';
    const isSdr = userRole === 'sdr';
    const isSdrCloser = userRole === 'sdr_closer';

    const sections = navSections.map(section => ({
      ...section,
      links: section.links.map(link => {
        if (link.href === '/novidades') {
          return { ...link, badge: hasUnseenChangelog ? 'Novo' : undefined };
        }
        if (link.href === '/atendimento' && unreadMsgCount > 0) {
          return { ...link, unreadCount: unreadMsgCount };
        }
        if (link.children) {
          return { ...link, children: link.children };
        }
        return link;
      }).filter(link => {
        if (isCloser && (link.href === '/automacoes' || link.href === '/membros')) return false;
        if ((isSdr || isSdrCloser) && link.href === '/membros') return false;
        return true;
      }),
    })).filter(section => section.links.length > 0);

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
  }, [isAdmin, userRole, hasBriefing, trialEnabled, hasUnseenChangelog]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast({ title: 'Logout realizado com sucesso', variant: 'default' });
      router.push('/login');
    } catch {
      toast({ title: 'Erro ao fazer logout', variant: 'destructive' });
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
        {/* Logo + collapse */}
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

        {/* Navigation — overflow-y-auto OK aqui, flyout sai pelo portal */}
        <nav className="flex-1 px-3 pt-3 space-y-3 overflow-y-auto">
          {allSections.map((section) => (
            <div key={section.label}>
              {!isCollapsed && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
                  {section.label}
                </p>
              )}
              {isCollapsed && <div className="mx-auto w-6 border-t border-border/50 mb-1" />}

              <div className="space-y-0.5">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = link.exact
                    ? pathname === link.href
                    : pathname === link.href || pathname.startsWith(link.href + '/');
                  const hasChildren = (link.children?.length ?? 0) > 0;

                  if (hasChildren) {
                    const isParentActive = link.children?.some(c => {
                      const base = c.href.split('?')[0];
                      return pathname === base || pathname.startsWith(base + '/');
                    }) || pathname === link.href || pathname.startsWith(link.href + '/');

                    return (
                      <div
                        key={link.href}
                        onMouseEnter={(e) => openFlyout(link, e.currentTarget)}
                        onMouseLeave={closeFlyout}
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
                            <ChevronRight className="h-3 w-3 opacity-50" />
                          </>
                        )}
                      </div>
                    );
                  }

                  const TOUR_TARGETS: Record<string, string> = {
                    '/atendimento': 'atendimento-link',
                    '/configuracoes/follow': 'canvas-link',
                  };

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={true}
                      data-tour={TOUR_TARGETS[link.href]}
                      className={cn(
                        'relative w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100',
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
                          {link.unreadCount && link.unreadCount > 0 ? (
                            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                              {link.unreadCount > 99 ? '99+' : link.unreadCount}
                            </span>
                          ) : link.badge ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium border border-primary/30">
                              {link.badge}
                            </span>
                          ) : null}
                        </>
                      )}
                      {isCollapsed && link.unreadCount && link.unreadCount > 0 ? (
                        <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">
                          {link.unreadCount > 9 ? '9+' : link.unreadCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-3">

          {/* Token card — aurora interno */}
          {!isCollapsed && !isTrial && tokensLimit > 0 && (() => {
            const pctRaw = tokensLimit > 0 ? (tokensUsed / tokensLimit) * 100 : 0;
            const pct = Math.min(100, pctRaw);
            const pctDisplay = pct < 1 && pct > 0 ? '< 1' : Math.round(pct).toString();
            const barWidth = Math.max(pct, tokensUsed > 0 ? 0.5 : 0);
            const isCritical = pct >= 95;
            const isWarning = pct >= 80;
            const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#15803d';
            return (
              <div className="relative rounded-xl border border-border/60 bg-card overflow-hidden p-3 space-y-2.5">
                {/* aurora background layer */}
                <div className="absolute inset-0 animate-aurora opacity-[0.08] pointer-events-none" />

                {/* content */}
                <div className="relative">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-foreground leading-none tracking-tight">Tokens mensais</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{planName || 'Plano atual'}</p>
                    </div>
                    <span className={cn(
                      'flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border uppercase tracking-wider',
                      isCritical ? 'border-red-500/30 text-red-500 bg-red-500/10'
                        : isWarning ? 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                        : 'border-primary/30 text-primary bg-primary/10'
                    )}>
                      {isCritical ? 'Crítico' : isWarning ? 'Atenção' : 'OK'}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-[15px] font-bold text-foreground tabular-nums">{tokensUsed.toLocaleString('pt-BR')}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">/ {tokensLimit.toLocaleString('pt-BR')}</span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{pctDisplay}% utilizado</p>
                  </div>

                  <Link
                    href="/planos"
                    className="mt-2.5 flex items-center justify-center gap-1 w-full h-7 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Fazer upgrade
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })()}

          {/* Trial banner */}
          {isTrial && !isCollapsed && (
            <div className={cn(
              'rounded-xl border p-3 space-y-2',
              trialDaysLeft === 0
                ? 'border-red-500/30 bg-red-500/5'
                : trialDaysLeft !== null && trialDaysLeft <= 2
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-primary/20 bg-primary/5'
            )}>
              <div className="flex items-center gap-2">
                <Zap className={cn('h-3.5 w-3.5 flex-shrink-0',
                  trialDaysLeft === 0 ? 'text-red-500'
                  : trialDaysLeft !== null && trialDaysLeft <= 2 ? 'text-amber-500'
                  : 'text-primary'
                )} />
                <p className="text-[11px] font-bold text-foreground leading-none">
                  {trialDaysLeft === null
                    ? 'Trial ativo'
                    : trialDaysLeft === 0
                    ? 'Trial expirado'
                    : trialDaysLeft === 1
                    ? '1 dia restante'
                    : `${trialDaysLeft} dias restantes`}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {trialDaysLeft === 0
                  ? 'Assine um plano para continuar usando o sistema.'
                  : 'Acesso completo durante o período de trial.'}
              </p>
              <Link
                href="/configuracoes?tab=plano"
                className="flex items-center justify-center gap-1 w-full h-7 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
              >
                Assinar agora
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
          {isTrial && isCollapsed && (
            <Link
              href="/configuracoes?tab=plano"
              title="Trial — Assinar agora"
              className="flex items-center justify-center w-9 h-9 mx-auto rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
            >
              <Zap className="h-4 w-4" />
            </Link>
          )}

          {/* Avatar */}
          <div className={cn('flex items-center gap-3 px-2 py-2 rounded-xl bg-accent/30', isCollapsed && 'justify-center px-2')}>
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
                <p className="text-xs text-muted-foreground truncate">{companyEmail || 'empresa@zaapply.com.br'}</p>
              </div>
            )}
          </div>

          {/* Theme + logout */}
          <div className={cn('flex items-center gap-2', isCollapsed && 'flex-col')}>
            <ThemeToggle />
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn('flex-1 justify-start text-muted-foreground hover:text-foreground hover:bg-accent/50', isCollapsed && 'justify-center px-2')}
              size={isCollapsed ? 'icon' : 'default'}
              title={isCollapsed ? 'Sair' : undefined}
            >
              <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
              {!isCollapsed && (isLoggingOut ? 'Saindo...' : 'Sair')}
            </Button>
          </div>

          {/* Links LGPD */}
          {!isCollapsed && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <Link
                href="/privacidade"
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Privacidade
              </Link>
              <span className="text-muted-foreground/30 text-[10px]">·</span>
              <Link
                href="/privacidade/solicitacao"
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Seus dados
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Flyout portal — fora do aside, sem clip de overflow */}
      {flyout && (
        <FlyoutPanel
          state={flyout}
          pathname={pathname}
          searchParams={searchParams}
          currentView={currentView}
          isTrial={isTrial}
          onClose={closeFlyout}
          onKeepOpen={keepFlyout}
        />
      )}

      <div className={cn('hidden md:block', isCollapsed ? 'md:w-20' : 'md:w-56')} />
    </>
  );
});
