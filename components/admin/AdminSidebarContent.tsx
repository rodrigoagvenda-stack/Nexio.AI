'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AdminSidebarContentProps {
  adminName?: string;
  adminEmail?: string;
}

export function AdminSidebarContent({ adminName, adminEmail }: AdminSidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const links = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/empresas', label: 'Empresas', icon: Building2 },
    { href: '/admin/usuarios', label: 'Usuários', icon: Users },
    { href: '/admin/briefing', label: 'Briefing', icon: FileText },
    { href: '/admin/logs', label: 'Logs', icon: Activity },
    { href: '/admin/ajuda', label: 'Ajuda', icon: HelpCircle },
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
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center h-20 px-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold">
            Nexio<span className="text-primary">.</span>AI
          </h1>
        </div>
      </div>

      {/* Menu Label */}
      <div className="px-6 pt-6 pb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Menu
        </span>
      </div>

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
                  : 'text-muted-foreground hover:bg-accent/50'
              )}
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
              <span className="font-medium text-sm">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border/50 space-y-3">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-accent/30">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-xs font-bold text-white">
              {adminName?.charAt(0)?.toUpperCase() || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{adminName || 'Admin'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {adminEmail || 'admin@nexio.ai'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="flex-1 justify-start gap-2"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao App
          </Button>
        </div>

        <div className="flex gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex-1 justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            size="sm"
          >
            {isLoggingOut ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
