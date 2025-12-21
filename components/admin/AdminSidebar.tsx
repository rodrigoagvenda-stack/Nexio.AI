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
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Shield,
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
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 z-50 flex flex-col bg-card border-r border-border transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-border">
          {!isCollapsed ? (
            <h1 className="text-2xl font-bold">
              vend<span className="text-primary">.</span>AI
            </h1>
          ) : (
            <h1 className="text-xl font-bold mx-auto">
              v<span className="text-primary">.</span>AI
            </h1>
          )}
        </div>

        {/* Admin Profile */}
        {!isCollapsed && (adminName || adminEmail) && (
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {adminName || 'Admin'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{adminEmail || ''}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href ||
              (link.href !== '/admin' && pathname.startsWith(link.href + '/'));

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  isCollapsed && 'justify-center'
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="flex-1">{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-border space-y-2">
          {/* Logout Button */}
          {!isCollapsed ? (
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full justify-start"
            >
              <LogOut className="h-4 w-4 mr-2" />
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}

          {/* Toggle Button (Desktop only) */}
          <div className="hidden lg:flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Spacer for content */}
      <div className={cn('hidden lg:block', isCollapsed ? 'w-20' : 'w-64')} />
    </>
  );
}
