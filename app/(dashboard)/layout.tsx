import { Sidebar } from '@/components/layout/Sidebar';
import { SystemTopBar } from '@/components/SystemTopBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { ZaapliLoader } from '@/components/brand/ZaapliLoader';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// 🔥 FORÇA RENDERIZAÇÃO DINÂMICA - SEM CACHE
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Buscar dados do usuário e admin check em paralelo
  const [{ data: userData }, { data: adminUser }] = await Promise.all([
    supabase
      .from('users')
      .select('company_id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle(),
    supabase
      .from('admin_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single(),
  ]);

  // Buscar dados da empresa e briefing config em paralelo
  const [{ data: companyData }, { data: briefingConfig }] = await Promise.all([
    supabase
      .from('companies')
      .select('name, email, image_url, plan_name, plan_type, trial_enabled, tokens_used, plan_monthly_limit')
      .eq('id', userData?.company_id || 0)
      .single(),
    supabase
      .from('briefing_company_config')
      .select('is_active, logo_url')
      .eq('company_id', userData?.company_id || 0)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  // Usuário sem empresa → onboarding (criou conta mas não completou setup)
  if (!userData?.company_id) {
    redirect('/onboarding');
  }

  const PLAN_LABELS: Record<string, string> = {
    basic: 'Zaapply Free', starter: 'Zaapply Start', pro: 'Zaapply Growth', scale: 'Zaapply Pro',
    free: 'Zaapply Free', start: 'Zaapply Start', growth: 'Zaapply Growth',
  };
  // Normalize plan_name legados (ex: "NEXIO GROWTH" → "Zaapply Growth")
  const LEGACY_NAME_MAP: Record<string, string> = {
    'nexio free': 'Zaapply Free', 'nexio start': 'Zaapply Start',
    'nexio growth': 'Zaapply Growth', 'nexio pro': 'Zaapply Pro',
    'zaapli free': 'Zaapply Free', 'zaapli start': 'Zaapply Start',
    'zaapli growth': 'Zaapply Growth', 'zaapli pro': 'Zaapply Pro',
  };
  const companyName = companyData?.name;
  const companyEmail = companyData?.email;
  const companyImage = companyData?.image_url;
  const rawPlanName = companyData?.plan_name ?? '';
  const planName =
    PLAN_LABELS[companyData?.plan_type ?? ''] ??
    LEGACY_NAME_MAP[rawPlanName.toLowerCase()] ??
    rawPlanName ||
    'Zaapply';
  const trialEnabled = companyData?.trial_enabled ?? false;
  const tokensUsed = companyData?.tokens_used ?? 0;
  const tokensLimit = companyData?.plan_monthly_limit ?? 0;
  const isAdmin = !!adminUser;
  const hasBriefing = !!briefingConfig;
  const userRole = userData?.role || 'closer';
  const brandLogoUrl = briefingConfig?.logo_url || null;

  return (
    <div className="flex h-screen bg-background">
      <ZaapliLoader minDuration={900} />
      <Sidebar
        isAdmin={isAdmin}
        companyName={companyName}
        companyEmail={companyEmail}
        companyImage={companyImage}
        planName={planName}
        hasBriefing={hasBriefing}
        brandLogoUrl={brandLogoUrl}
        userRole={userRole}
        trialEnabled={trialEnabled}
        tokensUsed={tokensUsed}
        tokensLimit={tokensLimit}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <SystemTopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 pb-[120px] lg:pb-6 w-full">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
