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

  // Fetch user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .single();

  console.log('[LAYOUT DEBUG] Auth User ID:', user.id);
  console.log('[LAYOUT DEBUG] User Data:', userData);
  console.log('[LAYOUT DEBUG] User Error:', userError);

  // Fetch company data separately
  let companyName: string | undefined;
  let companyEmail: string | undefined;
  let companyImage: string | undefined;
  let hasVendAgro = false;

  if (userData?.company_id) {
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, email, image_url, vendagro_plan')
      .eq('id', userData.company_id)
      .single();

    console.log('[LAYOUT DEBUG] Company ID:', userData.company_id);
    console.log('[LAYOUT DEBUG] Company Data:', companyData);
    console.log('[LAYOUT DEBUG] Company Error:', companyError);

    if (companyData) {
      companyName = companyData.name || undefined;
      companyEmail = companyData.email || undefined;
      companyImage = companyData.image_url || undefined;
      hasVendAgro = !!companyData.vendagro_plan;

      console.log('[LAYOUT DEBUG] Parsed - Name:', companyName, 'Email:', companyEmail, 'Image:', companyImage);
    }
  } else {
    console.log('[LAYOUT DEBUG] No company_id found for user');
  }

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
