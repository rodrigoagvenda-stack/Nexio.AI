'use client';

import { useUser } from '@/lib/hooks/useUser';
import { Bell, Settings, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export function DashboardHeader() {
  const { user, company } = useUser();
  const router = useRouter();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const userName = user?.name || 'Usuário';
  const userEmail = user?.email || 'user@vend.ai';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex items-center justify-between h-20 px-6">
        {/* Left side - Back button + User greeting */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">
                Olá, {userName}
              </h2>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Right side - Notifications + Settings */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="h-5 w-5" />
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  3
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-2">
                <h3 className="font-semibold mb-2">Notificações</h3>
                <div className="space-y-2">
                  <DropdownMenuItem className="flex-col items-start p-3 cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="font-medium text-sm">Novo lead cadastrado</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Lead "Empresa ABC" foi adicionado ao CRM
                    </p>
                    <span className="text-xs text-muted-foreground mt-1">Há 5 minutos</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex-col items-start p-3 cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="font-medium text-sm">Lead PRO extraído</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      15 novos leads foram extraídos via VendAgro
                    </p>
                    <span className="text-xs text-muted-foreground mt-1">Há 1 hora</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex-col items-start p-3 cursor-pointer">
                    <div className="flex items-center gap-2 w-full">
                      <div className="h-2 w-2 rounded-full bg-muted" />
                      <span className="font-medium text-sm">Briefing respondido</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cliente respondeu o briefing de projeto
                    </p>
                    <span className="text-xs text-muted-foreground mt-1">Há 2 horas</span>
                  </DropdownMenuItem>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/configuracoes')}
            className="rounded-full"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
