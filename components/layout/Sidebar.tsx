'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { useState, useEffect, useRef, memo, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Table2,
  Kanban,
  Zap,
  BarChart2,
  Wallet,
  Shield,
} from 'lucide-react';
import { TrendingUpIcon } from '@/components/ui/trending-up';
import { ChartPieIcon } from '@/components/ui/chart-pie';
import { MessageCircleMoreIcon } from '@/components/ui/message-circle-more';
import { BotIcon } from '@/components/ui/bot';
import { BotMessageSquareIcon } from '@/components/ui/bot-message-square';
import { CursorClickIcon } from '@/components/ui/cursor-click';
import { CalendarDaysIcon } from '@/components/ui/calendar-days';
import { ChartLineIcon } from '@/components/ui/chart-line';
import { UserRoundCogIcon } from '@/components/ui/user-round-cog';
import { FlameIcon } from '@/components/ui/flame';
import { CircleHelpIcon } from '@/components/ui/circle-help';
import { FileTextIcon } from '@/components/ui/file-text';
import { ReceiptTextIcon } from '@/components/ui/receipt-text';
import { CogIcon } from '@/components/ui/cog';
import { ShieldCheckIcon } from '@/components/ui/shield-check';
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
  gtproConnected?: boolean;
  features?: Record<string, boolean>;
}

function playNotifSound() {
  if (typeof window !== 'undefined' && localStorage.getItem('zaapply_notif_sound') === 'false') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.28, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    // Dois tons ascendentes: estilo WhatsApp
    playNote(830, ctx.currentTime, 0.18);
    playNote(1046, ctx.currentTime + 0.12, 0.28);
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
      { href: '/dashboard', label: 'Dashboard', icon: TrendingUpIcon },
    ],
  },
  {
    label: 'Ferramentas',
    links: [
      {
        href: '/crm',
        label: 'CRM',
        icon: ChartPieIcon,
        children: [
          { href: '/crm?view=table', label: 'Planilha', icon: Table2 },
          { href: '/crm?view=kanban', label: 'Kanban', icon: Kanban },
          { href: '/crm/time', label: 'Dashboard Time', icon: BarChart2 },
          { href: '/crm/auditoria', label: 'Auditoria', icon: Shield },
        ],
      },
      { href: '/atendimento', label: 'Atendimento', icon: MessageCircleMoreIcon },
      {
        href: '/automacoes',
        label: 'Automações',
        icon: BotIcon,
        children: [
          { href: '/configuracoes/sdr', label: 'Agente SDR', icon: BotMessageSquareIcon },
          { href: '/configuracoes/follow', label: 'Canvas', icon: CursorClickIcon },
          { href: '/configuracoes/agenda', label: 'Agenda', icon: CalendarDaysIcon },
          { href: '/configuracoes/metricas', label: 'Métricas', icon: ChartLineIcon },
        ],
      },
    ],
  },
  {
    label: 'Gestão',
    links: [
      { href: '/membros', label: 'Membros', icon: UserRoundCogIcon },
    ],
  },
  {
    label: 'Sistema',
    links: [
      { href: '/novidades', label: 'Novidades', icon: FlameIcon },
      {
        href: '/ajuda',
        label: 'Ajuda',
        icon: CircleHelpIcon,
        children: [
          { href: '/ajuda', label: 'Documentação', icon: FileTextIcon },
          { href: '/suporte', label: 'Tickets', icon: ReceiptTextIcon },
        ],
      },
      { href: '/configuracoes', label: 'Configuração', icon: CogIcon, exact: true },
    ],
  },
];

// ─── Animated icon ref types ──────────────────────────────────────────────────
type AnyIconHandle = { startAnimation: () => void; stopAnimation: () => void };
type AnyAnimIcon = React.ForwardRefExoticComponent<
  React.HTMLAttributes<HTMLDivElement> & { size?: number } & React.RefAttributes<AnyIconHandle>
>;

const TOUR_TARGETS: Record<string, string> = {
  '/atendimento': 'atendimento-link',
  '/configuracoes/follow': 'canvas-link',
};

// ─── Nav item sub-components (need useRef at component level) ─────────────────
function NavItemLinkComp({
  link, isActive, isCollapsed, onClick,
}: {
  link: NavLink; isActive: boolean; isCollapsed: boolean; onClick?: () => void;
}) {
  const iconRef = useRef<AnyIconHandle>(null);
  const Icon = link.icon as unknown as AnyAnimIcon;
  return (
    <Link
      href={link.href}
      prefetch={true}
      data-tour={TOUR_TARGETS[link.href]}
      onClick={onClick}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      className={cn(
        'relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100',
        isActive
          ? 'bg-accent dark:bg-[#191919]/80 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 dark:hover:bg-[#191919]/40',
        isCollapsed && 'justify-center px-2'
      )}
      title={isCollapsed ? link.label : undefined}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon ref={iconRef} size={16} className="flex-shrink-0" />
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
}

function NavItemFlyoutComp({
  link, isParentActive, isCollapsed, onMouseEnter, onMouseLeave,
}: {
  link: NavLink; isParentActive: boolean; isCollapsed: boolean;
  onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
}) {
  const iconRef = useRef<AnyIconHandle>(null);
  const Icon = link.icon as unknown as AnyAnimIcon;
  return (
    <div
      onMouseEnter={(e) => { iconRef.current?.startAnimation(); onMouseEnter(e); }}
      onMouseLeave={() => { iconRef.current?.stopAnimation(); onMouseLeave(); }}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors duration-100 select-none',
        isParentActive
          ? 'bg-accent dark:bg-[#191919]/80 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 dark:hover:bg-[#191919]/40',
        isCollapsed && 'justify-center px-2'
      )}
      title={isCollapsed ? link.label : undefined}
    >
      <Icon ref={iconRef} size={16} className="flex-shrink-0" />
      {!isCollapsed && (
        <>
          <span className="text-sm flex-1 text-left">{link.label}</span>
          <ChevronRight className="h-3 w-3 opacity-50" />
        </>
      )}
    </div>
  );
}

function FlyoutChildLink({
  child, isActive, onClose,
}: {
  child: NavChild; isActive: boolean; onClose: () => void;
}) {
  const iconRef = useRef<AnyIconHandle>(null);
  const Icon = child.icon as unknown as AnyAnimIcon;
  return (
    <Link
      href={child.href}
      prefetch={true}
      onClick={onClose}
      onMouseEnter={() => iconRef.current?.startAnimation?.()}
      onMouseLeave={() => iconRef.current?.stopAnimation?.()}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-100',
        isActive
          ? 'bg-accent dark:bg-[#191919]/80 text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60 dark:hover:bg-[#191919]/40'
      )}
    >
      <Icon ref={iconRef} size={14} className="flex-shrink-0" />
      <span>{child.label}</span>
    </Link>
  );
}

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
        const ChildIcon = child.icon as React.ComponentType<{ className?: string }>;
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
        // CRM children use plain lucide icons; animated children use FlyoutChildLink
        if (isCrmChild) {
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
        }
        return (
          <FlyoutChildLink
            key={child.href}
            child={child}
            isActive={isChildActive}
            onClose={onClose}
          />
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
  gtproConnected = false,
  features = {},
}: SidebarProps) {
  const trialDaysLeft = useMemo(() => {
    if (!isTrial || !trialEndsAt) return null;
    const today = new Date();
    const end = new Date(trialEndsAt);
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.max(0, Math.round((endUTC - todayUTC) / (1000 * 60 * 60 * 24)));
  }, [isTrial, trialEndsAt]);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [flyout, setFlyout] = useState<FlyoutState | null>(null);
  const [hasUnseenChangelog, setHasUnseenChangelog] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const [hasPaymentIntegration, setHasPaymentIntegration] = useState(false);
  const flyoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSoundRef = useRef<number>(0);

  // Subscription de mensagens inbound: contador + som
  useEffect(() => {
    if (!companyId) return;
    const supabase = createClient();

    // Conta total de não lidas somando conversas_do_whatsapp.contagem_nao_lida
    supabase
      .from('conversas_do_whatsapp')
      .select('contagem_nao_lida')
      .eq('company_id', companyId)
      .gt('contagem_nao_lida', 0)
      .then(({ data }: { data: any }) => {
        const total = (data ?? []).reduce((s: number, c: any) => s + (c.contagem_nao_lida ?? 0), 0);
        setUnreadMsgCount(total);
      });

    // Realtime: escuta UPDATE em conversas_do_whatsapp (contagem_nao_lida muda)
    const channel = supabase
      .channel(`sidebar_convs_${companyId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversas_do_whatsapp',
        filter: `company_id=eq.${companyId}`,
      }, (payload: any) => {
        const prev = (payload.old as any)?.contagem_nao_lida ?? 0;
        const next = (payload.new as any)?.contagem_nao_lida ?? 0;
        if (next > prev) {
          setUnreadMsgCount((c) => c + (next - prev));
          const now = Date.now();
          if (now - lastSoundRef.current > 2000) {
            lastSoundRef.current = now;
            playNotifSound();
          }
        } else if (next < prev) {
          // Conversa foi lida: reduz contador
          setUnreadMsgCount((c) => Math.max(0, c - (prev - next)));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  // Zera contador ao clicar em Atendimento (não ao entrar pela rota)
  const handleAtendimentoClick = () => {
    setUnreadMsgCount(0);
    // Zera contagem no banco para todas as conversas desta empresa
    createClient()
      .from('conversas_do_whatsapp')
      .update({ contagem_nao_lida: 0 })
      .eq('company_id', companyId ?? 0)
      .gt('contagem_nao_lida', 0)
      .then(() => {});
  };

  useEffect(() => {
    if (!companyId) return;
    fetch('/api/payment-integrations')
      .then(r => r.json())
      .then(d => {
        const active = (d.integrations ?? []).some((i: any) => i.active);
        setHasPaymentIntegration(active);
      })
      .catch(() => {});
  }, [companyId]);

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
        if (link.href === '/crm') {
          const metaChild = gtproConnected && features.meta_ads
            ? [{ href: '/crm/meta', label: 'Meta Ads', icon: BarChart2 }]
            : [];
          return { ...link, children: [...(link.children ?? []), ...metaChild] };
        }
        if (link.href === '/automacoes') {
          const children = (link.children ?? []).filter(child => {
            if (child.href === '/configuracoes/follow' && !features.canvas) return false;
            if (child.href === '/configuracoes/agenda' && !features.agenda) return false;
            if (child.href === '/configuracoes/metricas' && !features.metricas) return false;
            return true;
          });
          return { ...link, children };
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
            ...(hasBriefing ? [{ href: '/briefing', label: 'Briefing', icon: FileTextIcon }] : []),
            ...(hasPaymentIntegration && features.financeiro ? [{ href: '/financeiro', label: 'Financeiro', icon: Wallet }] : []),
          ],
        };
      }
      if (section.label === 'Sistema') {
        return {
          ...section,
          links: [
            ...section.links,
            ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheckIcon, badge: 'ADMIN' }] : []),
          ],
        };
      }
      return section;
    });
  }, [isAdmin, userRole, hasBriefing, trialEnabled, hasUnseenChangelog, gtproConnected, hasPaymentIntegration, features]);

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

        {/* Navigation: overflow-y-auto OK aqui, flyout sai pelo portal */}
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
                      <NavItemFlyoutComp
                        key={link.href}
                        link={link}
                        isParentActive={isParentActive}
                        isCollapsed={isCollapsed}
                        onMouseEnter={(e) => openFlyout(link, e.currentTarget)}
                        onMouseLeave={closeFlyout}
                      />
                    );
                  }

                  return (
                    <NavItemLinkComp
                      key={link.href}
                      link={link}
                      isActive={isActive}
                      isCollapsed={isCollapsed}
                      onClick={link.href === '/atendimento' ? handleAtendimentoClick : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-3">

          {/* Token card */}
          {!isCollapsed && !isTrial && tokensLimit > 0 && (() => {
            const pctRaw = tokensLimit > 0 ? (tokensUsed / tokensLimit) * 100 : 0;
            const pct = Math.min(100, pctRaw);
            const pctDisplay = pct < 1 && pct > 0 ? '< 1' : Math.round(pct).toString();
            const barWidth = Math.max(pct, tokensUsed > 0 ? 0.5 : 0);
            const isCritical = pct >= 95;
            const isWarning = pct >= 80;
            const barColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#96F63C';
            return (
              <div
                className="relative rounded-xl overflow-hidden p-3 space-y-2"
                style={{
                  backdropFilter: 'blur(24px)',
                  background: 'linear-gradient(135deg, rgba(7,38,28,0.85) 0%, rgba(14,64,40,0.85) 56%, rgba(10,48,30,0.85) 100%)',
                  border: '1px solid rgba(96,246,60,0.18)',
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-foreground leading-none tracking-tight">Tokens mensais</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">{planName || 'Plano atual'}</p>
                  </div>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-[15px] font-bold text-foreground tabular-nums">{tokensUsed.toLocaleString('pt-BR')}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">/ {tokensLimit.toLocaleString('pt-BR')}</span>
                </div>

                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: '#0C0C0C' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(barWidth, tokensUsed > 0 ? 3 : 0)}%`, backgroundColor: barColor }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pctDisplay}% utilizado</p>
                </div>

                <Link
                  href="/planos"
                  className="flex items-center justify-center w-full rounded-full text-[11px] font-semibold active:translate-y-px transition-transform"
                  style={{ height: 28, backgroundColor: '#141414', color: '#D8D8D8', boxShadow: '0 2px 0 0 #1F1F1F' }}
                >
                  Fazer upgrade
                </Link>
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
              title="Trial: Assinar agora"
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

      {/* Flyout portal: fora do aside, sem clip de overflow */}
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
