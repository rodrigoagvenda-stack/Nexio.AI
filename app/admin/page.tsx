import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Building2, Users, Activity } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Painel administrativo do vend.AI</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/admin/briefing">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Briefing
              </CardTitle>
              <CardDescription>Respostas do formulário</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/empresas">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Empresas
              </CardTitle>
              <CardDescription>Em breve</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/usuarios">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Usuários
              </CardTitle>
              <CardDescription>Em breve</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/logs">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Logs
              </CardTitle>
              <CardDescription>Em breve</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
