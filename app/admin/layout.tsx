import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

export default async function AdminLayout({
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

  // Verificar se é admin
  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (!adminUser) {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar adminName={adminUser.name} adminEmail={adminUser.email} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader adminName={adminUser.name} adminEmail={adminUser.email} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
