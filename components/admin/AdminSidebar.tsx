'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Activity,
  HelpCircle,
  LogOut,
  Shield,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface AdminSidebarProps {
  adminName?: string;
  adminEmail?: string;
}

export function AdminSidebar({ adminName, adminEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const links = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/admin/empresas',
      label: 'Empresas',
      icon: Building2,
    },
    {
      href: '/admin/usuarios',
      label: 'Usuários',
      icon: Users,
    },
    {
      href: '/admin/briefing',
      label: 'Briefing',
      icon: FileText,
    },
    {
      href: '/admin/logs',
      label: 'Logs',
      icon: Activity,
    },
    {
      href: '/admin/ajuda',
      label: 'Ajuda',
      icon: HelpCircle,
    },
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
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <Shield className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && (
              <h1 className="text-xl font-semibold">
                vend<span className="text-primary">.</span>AI
              </h1>
            )}
          </div>
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
            const isActive =
              pathname === link.href ||
              (link.href !== '/admin' && pathname.startsWith(link.href + '/'));

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
                {!isCollapsed && <span className="font-medium text-sm">{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border/50">
          <div
            className={cn(
              'flex items-center gap-3 px-3 py-3 rounded-xl bg-accent/30',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {adminName?.charAt(0)?.toUpperCase() || 'A'}
              </span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{adminName || 'Admin'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {adminEmail || 'admin@vend.ai'}
                </p>
              </div>
            )}
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={cn(
              'w-full mt-2 justify-start text-muted-foreground hover:text-foreground',
              isCollapsed && 'justify-center px-2'
            )}
            size={isCollapsed ? 'icon' : 'default'}
            title={isCollapsed ? 'Sair' : undefined}
          >
            <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
            {!isCollapsed && (isLoggingOut ? 'Saindo...' : 'Sair')}
          </Button>

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
