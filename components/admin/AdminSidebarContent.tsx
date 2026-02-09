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
  ArrowLeft,
  Webhook,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AdminSidebarContentProps {
  adminName?: string;
  adminEmail?: string;
}

const navLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/empresas', label: 'Empresas', icon: Building2 },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/briefing', label: 'Briefing', icon: FileText },
  { href: '/admin/qualificacao', label: 'Qualificação', icon: UserCheck },
  { href: '/admin/webhooks', label: 'Webhooks & APIs', icon: Webhook },
  { href: '/admin/n8n', label: 'Monitor N8N', icon: Activity },
  { href: '/admin/logs', label: 'Logs', icon: Activity },
  { href: '/admin/ajuda', label: 'Ajuda', icon: HelpCircle },
];

export function AdminSidebarContent({ adminName, adminEmail }: AdminSidebarContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso');
      router.push('/login');
    } catch {
      toast.error('Erro ao fazer logout');
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Logo */}
      <div className="flex items-center h-16 px-6">
        <h1 className="text-xl">
          <span className="font-normal text-foreground">nexio</span>
          <span className="text-primary font-bold">.</span>
          <span className="font-normal text-foreground">ai</span>
          <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium border border-primary/30">
            ADMIN
          </span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pt-4 space-y-1 overflow-y-auto">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== '/admin' && pathname.startsWith(link.href + '/'));

          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={true}
              className={cn(
                'w-full group flex items-center gap-3 px-3 py-3 rounded-lg transition-colors duration-100',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm flex-1 text-left">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Admin Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-accent/30">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">
              {adminName?.charAt(0)?.toUpperCase() || 'A'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{adminName || 'Admin'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {adminEmail || 'admin@nexio.ai'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            asChild
            className="flex-1 justify-start text-muted-foreground hover:text-foreground hover:bg-accent/50"
            size="default"
          >
            <Link href="/dashboard" prefetch={true}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full mt-1 justify-start text-muted-foreground hover:text-foreground hover:bg-accent/50"
          size="default"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isLoggingOut ? 'Saindo...' : 'Sair'}
        </Button>
      </div>
    </div>
  );
}
