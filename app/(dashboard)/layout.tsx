import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
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

  // Fetch user data to check vendagro plan
  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('auth_user_id', user.id)
    .single();

  let hasVendAgro = false;
  if (userData?.company_id) {
    const { data: companyData } = await supabase
      .from('companies')
      .select('vendagro_plan')
      .eq('id', userData.company_id)
      .single();

    hasVendAgro = !!companyData?.vendagro_plan;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar hasVendAgro={hasVendAgro} />
      <div className="flex-1 flex flex-col md:ml-64">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
