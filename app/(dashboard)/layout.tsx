import { Sidebar } from '@/components/layout/Sidebar';
import { SystemTopBar } from '@/components/SystemTopBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
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
      .select('company_id')
      .eq('auth_user_id', user.id)
      .single(),
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
      .select('name, email, image_url, plan_name')
      .eq('id', userData?.company_id || 0)
      .single(),
    supabase
      .from('briefing_company_config')
      .select('is_active')
      .eq('company_id', userData?.company_id || 0)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  const companyName = companyData?.name;
  const companyEmail = companyData?.email;
  const companyImage = companyData?.image_url;
  const planName = companyData?.plan_name;
  const isAdmin = !!adminUser;
  const hasBriefing = !!briefingConfig;

  console.log('🔍 [Layout] Company Data:', {
    companyId: userData?.company_id,
    planName,
    companyName,
    rawData: companyData
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isAdmin={isAdmin}
        companyName={companyName}
        companyEmail={companyEmail}
        companyImage={companyImage}
        planName={planName}
        hasBriefing={hasBriefing}
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
