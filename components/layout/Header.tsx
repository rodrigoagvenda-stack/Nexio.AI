'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings, Bell } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@/lib/hooks/useUser';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const { user, company } = useUser();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast({ title: 'Logout realizado com sucesso!' });
    router.push('/login');
    router.refresh();
  };

  const avatarUrl = (user as any)?.avatar_url || company?.image_url || null;
  const displayName = user?.name || company?.name || 'Usuário';
  const displayEmail = user?.email || company?.email || '';
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <header
      className="mx-4 mt-3 mb-1 h-[54px] rounded-xl flex items-center justify-between px-4 flex-shrink-0"
      style={{
        backgroundImage: 'linear-gradient(270deg, #1a3d2a 0%, #0d1f14 100%)',
        filter: 'brightness(150%)',
      }}
    >
      {/* Avatar + user info */}
      <div className="flex items-center gap-3">
        <div className="w-[22px] h-[22px] rounded-full flex-shrink-0 overflow-hidden bg-primary/30 flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[9px] font-bold text-white">{initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-white leading-none truncate">{displayName}</p>
          <p className="text-[9px] text-white/60 truncate mt-0.5">{displayEmail}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5">
        <Link href="/notificacoes">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Bell className="h-4 w-4" />
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/configuracoes')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
