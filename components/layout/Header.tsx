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
import { LogOut, Settings, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/hooks/useUser';

export function Header() {
  const router = useRouter();
  const { user, company } = useUser();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Logout realizado com sucesso!');
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          {company?.name || 'vend.AI'}
        </h2>
        <p className="text-xs text-muted-foreground">
          {company?.plan_type === 'basic' && 'Plano Básico'}
          {company?.plan_type === 'performance' && 'Plano Performance'}
          {company?.plan_type === 'advanced' && 'Plano Advanced'}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              <span>{user?.name || 'Usuário'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
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
