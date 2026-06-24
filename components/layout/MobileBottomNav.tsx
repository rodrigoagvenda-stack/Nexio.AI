'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Bell,
  MoreHorizontal, X, PieChart,
  Sparkles, HelpCircle, Settings, LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BotMessageSquareIcon } from '@/components/ui/bot-message-square';

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isCrm = pathname?.startsWith('/crm');
  const isDashboard = pathname === '/dashboard' || pathname?.startsWith('/dashboard/');
  const isChat = pathname?.startsWith('/atendimento');
  const isNotif = pathname?.startsWith('/notificacoes');
  const isMore =
    pathname?.startsWith('/novidades') ||
    pathname?.startsWith('/ajuda') ||
    pathname?.startsWith('/configuracoes') ||
    pathname?.startsWith('/membros');

  function navigate(href: string) {
    setMoreOpen(false);
    router.push(href);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const moreItems = [
    { href: '/novidades', label: 'Novidades', icon: Sparkles },
    { href: '/ajuda', label: 'Ajuda', icon: HelpCircle },
    { href: '/configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Mais drawer */}
      {moreOpen && (
        <div className="fixed bottom-[88px] left-4 right-4 z-50 md:hidden rounded-2xl overflow-hidden shadow-2xl border border-white/8"
          style={{ background: '#1A1A1A' }}>
          <div className="p-2">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname?.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-colors text-left"
                  style={{ color: isActive ? '#01573C' : '#AAAAAA', background: isActive ? '#01573C15' : 'transparent' }}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#01573C' }} />}
                </button>
              );
            })}

            <div className="mx-4 my-1 border-t border-white/8" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl transition-colors text-left"
              style={{ color: '#EF4444' }}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Sair</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden">
        <div className="relative flex items-end justify-around px-2 py-3 rounded-2xl border border-white/8 shadow-2xl"
          style={{ background: '#141414' }}>

          {/* CRM */}
          <NavBtn
            icon={PieChart}
            label="CRM"
            active={isCrm}
            onClick={() => { setMoreOpen(false); navigate('/crm'); }}
          />

          {/* Dashboard */}
          <NavBtn
            icon={LayoutDashboard}
            label="Início"
            active={isDashboard}
            onClick={() => { setMoreOpen(false); navigate('/dashboard'); }}
          />

          {/* Chat FAB — centro elevado */}
          <div className="relative flex flex-col items-center -mt-6">
            <button
              onClick={() => { setMoreOpen(false); navigate('/atendimento'); }}
              className="flex items-center justify-center w-14 h-14 rounded-full transition-transform active:scale-95"
              style={{
                background: '#141414',
                boxShadow: '0 4px 20px rgba(0,0,0,0.55), 0 2px 0 0 #0A0A0A, 0 0 0 1.5px rgba(255,255,255,0.08)',
              }}
            >
              <BotMessageSquareIcon
                size={26}
                loop
                style={{ color: '#96F63C' }}
              />
            </button>
            <span className="mt-1.5 text-[10px] font-medium" style={{ color: isChat ? '#96F63C' : '#666' }}>
              Chat
            </span>
          </div>

          {/* Notificações */}
          <NavBtn
            icon={Bell}
            label="Alertas"
            active={isNotif}
            onClick={() => { setMoreOpen(false); navigate('/notificacoes'); }}
          />

          {/* Mais */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
              style={{ background: (isMore || moreOpen) ? '#01573C20' : 'transparent' }}>
              {moreOpen
                ? <X className="h-5 w-5" style={{ color: '#01573C' }} />
                : <MoreHorizontal className="h-5 w-5" style={{ color: (isMore || moreOpen) ? '#01573C' : '#666' }} />}
            </div>
            <span className="text-[10px] font-medium" style={{ color: (isMore || moreOpen) ? '#01573C' : '#666' }}>
              Mais
            </span>
          </button>

        </div>
      </nav>
    </>
  );
}

function NavBtn({
  icon: Icon, label, active, onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors"
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
        style={{ background: active ? '#01573C20' : 'transparent' }}>
        <Icon className="h-5 w-5" style={{ color: active ? '#01573C' : '#666' }} />
      </div>
      <span className="text-[10px] font-medium" style={{ color: active ? '#01573C' : '#666' }}>
        {label}
      </span>
    </button>
  );
}
