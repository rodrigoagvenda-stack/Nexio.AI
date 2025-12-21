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
          'fixed inset-y-0 z-50 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 transition-all duration-300',
          isCollapsed ? 'w-20' : 'w-72',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo & Admin Badge */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-700">
          {!isCollapsed ? (
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-white">
                vend<span className="text-primary">.</span>AI
              </h1>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Admin Panel
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <h1 className="text-xl font-black text-white">
                v<span className="text-primary">.</span>AI
              </h1>
            </div>
          )}
        </div>

        {/* Admin Profile */}
        {!isCollapsed && (adminName || adminEmail) && (
          <div className="p-4 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {adminName || 'Admin'}
                </p>
                <p className="text-xs text-slate-400 truncate">{adminEmail || ''}</p>
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
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium',
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white',
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
        <div className="p-4 border-t border-slate-700 space-y-2">
          {/* Logout Button */}
          {!isCollapsed ? (
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full justify-start text-slate-300 hover:text-white hover:bg-red-500/10"
            >
              <LogOut className="h-5 w-5 mr-3" />
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full text-slate-300 hover:text-white hover:bg-red-500/10"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          )}

          {/* Toggle Button (Desktop only) */}
          <div className="hidden lg:flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hover:bg-slate-700/50 text-slate-400 hover:text-white"
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Spacer for content */}
      <div className={cn('hidden lg:block', isCollapsed ? 'w-20' : 'w-72')} />
    </>
  );
}
