import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Zap } from 'lucide-react';

export default async function AtendimentoLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const { data: company } = await supabase
    .from('companies')
    .select('plan_type')
    .eq('id', userData?.company_id || 0)
    .single();

  const planType = company?.plan_type ?? 'basic';
  const hasAccess = planType !== 'basic';

  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative w-full h-full">
      {/* Conteúdo ofuscado */}
      <div className="pointer-events-none select-none" style={{ filter: 'blur(6px)', opacity: 0.4 }}>
        {children}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Zap className="h-7 w-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Atendimento WhatsApp</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Receba mensagens, escaneie o QR Code e gerencie conversas com IA — disponível nos planos pagos.
            </p>
          </div>
          <div className="space-y-2">
            <Link
              href="/configuracoes?tab=plano"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Assinar agora
            </Link>
            <p className="text-[11px] text-muted-foreground">
              A partir de R$ 397/mês · Cancele quando quiser
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
