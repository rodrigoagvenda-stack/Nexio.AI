import { Sidebar } from '@/components/layout/Sidebar';
import { SystemTopBar } from '@/components/SystemTopBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

  // Buscar usuário e empresa (IGUAL ao admin)
  const { data: userData } = await supabase
    .from('users')
    .select(`
      id,
      name,
      email,
      company_id,
      companies (
        id,
        name,
        email,
        image_url,
        vendagro_plan
      )
    `)
    .eq('auth_user_id', user.id)
    .single();

  const company = userData?.companies as any;
  const companyName = company?.name;
  const companyEmail = company?.email;
  const companyImage = company?.image_url;
  const hasVendAgro = !!company?.vendagro_plan;

  // Check if user is admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  const isAdmin = !!adminUser;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        hasVendAgro={hasVendAgro}
        isAdmin={isAdmin}
        companyName={companyName}
        companyEmail={companyEmail}
        companyImage={companyImage}
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
