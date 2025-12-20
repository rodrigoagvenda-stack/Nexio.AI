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

  // Fetch user AND company data in ONE optimized query (JOIN)
  const { data: userData } = await supabase
    .from('users')
    .select('company_id, companies:company_id(vendagro_plan)')
    .eq('auth_user_id', user.id)
    .single();

  const hasVendAgro = !!(userData?.companies as any)?.vendagro_plan;

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
