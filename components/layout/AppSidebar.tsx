'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  TrendingUp,
  PieChart,
  MessageCircle,
  UserCog,
  Info,
  ShieldCheck,
  LogOut,
  Bot,
  Zap,
  ChevronRight,
  Table2,
  Kanban,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useState } from 'react';

interface AppSidebarProps {
  isAdmin?: boolean;
  companyName?: string;
  companyEmail?: string;
  companyImage?: string;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: TrendingUp },
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
  { href: '/membros', label: 'Membros', icon: UserCog },
  { href: '/ajuda', label: 'Ajuda', icon: Info },
  { href: '/configuracao', label: 'Configuração', icon: Zap },
];

export function AppSidebar({
  isAdmin = false,
  companyName,
  companyEmail,
  companyImage,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const allItems = [
    ...navItems,
    ...(isAdmin
      ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }]
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
    <Sidebar collapsible="icon">
      {/* Header - Logo */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">N</span>
          </div>
          <h1 className="text-lg group-data-[collapsible=icon]:hidden">
            <span className="font-normal text-sidebar-foreground">nexio</span>
            <span className="text-primary font-bold">.</span>
            <span className="font-normal text-sidebar-foreground">ai</span>
          </h1>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const hasChildren = 'children' in item && item.children;

                if (hasChildren) {
                  const isCrmActive = pathname === '/crm' || pathname.startsWith('/crm');
                  return (
                    <Collapsible
                      key={item.href}
                      asChild
                      defaultOpen={isCrmActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip={item.label} isActive={isCrmActive}>
                            <Icon />
                            <span>{item.label}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const isChildActive = typeof window !== 'undefined'
                                ? window.location.href.includes(child.href)
                                : false;
                              return (
                                <SidebarMenuSubItem key={child.href}>
                                  <SidebarMenuSubButton asChild isActive={isChildActive}>
                                    <Link href={child.href} prefetch={true}>
                                      <ChildIcon />
                                      <span>{child.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild tooltip={item.label} isActive={isActive}>
                      <Link href={item.href} prefetch={true}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer - Company + Actions */}
      <SidebarFooter>
        <SidebarMenu>
          {/* Company Profile */}
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center overflow-hidden">
                {companyImage ? (
                  <img src={companyImage} alt={companyName || 'Empresa'} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary-foreground">
                    {companyName?.charAt(0)?.toUpperCase() || 'E'}
                  </span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{companyName || 'Empresa'}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {companyEmail || 'empresa@nexio.ai'}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Theme Toggle */}
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>

          {/* Logout */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sair"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut />
              <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
