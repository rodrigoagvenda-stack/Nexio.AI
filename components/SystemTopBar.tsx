'use client';

import { useUser } from '@/lib/hooks/useUser';
import { Settings, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface SystemTopBarProps {
  userName?: string | null;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
}

export function SystemTopBar({ userName: userNameProp, userEmail: userEmailProp, userAvatarUrl: userAvatarUrlProp }: SystemTopBarProps = {}) {
  const { user, company } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Nome/email/avatar vêm do server (layout.tsx, mesma consulta que já
  // alimenta a Sidebar) como fonte principal : o hook useUser() faz a mesma
  // busca no navegador, sujeita a sessão/RLS instável, e servia só de
  // fallback antes — trocado porque falhava (ficava em branco) sem que a
  // Sidebar, que é server-side, apresentasse o mesmo problema.
  const userName = userNameProp || user?.name || 'Usuário';
  const userEmail = userEmailProp || user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarUrl = userAvatarUrlProp || (user as any)?.avatar_url || (user as any)?.photo_url || company?.image_url || null;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast({ title: 'Logout realizado com sucesso!' });
    router.push('/login');
    router.refresh();
  };

  if (pathname?.includes('/configuracoes')) {
    return null;
  }

  const isAtendimento = pathname?.startsWith('/atendimento');

  return (
    <header
      className={cn(
        "h-[88px] md:h-[80px] flex items-center justify-between px-5 flex-shrink-0 transition-all duration-300",
        "mx-auto mt-3 mb-1 rounded-2xl w-[90%] md:w-[calc(100%-2rem)] md:mx-4",
        isAtendimento && "hidden md:flex"
      )}
      style={{
        background: 'linear-gradient(270deg, #01573C 0%, #07261C 100%)',
      }}
    >
      {/* Left: User info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-white/20 flex items-center justify-center"
          style={{ border: '2px solid #90FC1D' }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-base font-bold" style={{ color: '#D4D4D4' }}>{userInitials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-none truncate" style={{ color: '#D4D4D4' }}>{userName}</p>
          <p className="text-sm font-medium truncate mt-1" style={{ color: '#D4D4D4', opacity: 0.6 }}>{userEmail}</p>
        </div>
      </div>

      {/* Right: Notifications + Settings */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <NotificationBell />

        {/* Settings */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="h-10 w-10 flex items-center justify-center rounded-full cursor-pointer text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
              <Settings className="h-5 w-5" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
