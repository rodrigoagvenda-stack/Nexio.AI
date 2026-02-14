import { Sidebar } from '@/components/layout/Sidebar';
import { SystemTopBar } from '@/components/SystemTopBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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

  // Buscar dados da empresa (depende do company_id)
  const { data: companyData } = await supabase
    .from('companies')
    .select('name, email, image_url, plan_name')
    .eq('id', userData?.company_id || 0)
    .single();

  const companyName = companyData?.name;
  const companyEmail = companyData?.email;
  const companyImage = companyData?.image_url;
  const planName = companyData?.plan_name;
  const isAdmin = !!adminUser;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isAdmin={isAdmin}
        companyName={companyName}
        companyEmail={companyEmail}
        companyImage={companyImage}
        planName={planName}
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
