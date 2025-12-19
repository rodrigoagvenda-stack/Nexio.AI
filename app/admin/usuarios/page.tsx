'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils/format';

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users');
      const data = await response.json();
      setUsers(data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">👥 Usuários</h1>

      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">Cargo</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Último Login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: any) => (
                  <tr key={user.id} className="border-b hover:bg-accent">
                    <td className="p-3 font-medium">{user.name}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3 text-sm text-muted-foreground">{user.company?.name || '-'}</td>
                    <td className="p-3 text-sm">{user.department || '-'}</td>
                    <td className="p-3">
                      {user.is_active ? (
                        <Badge className="bg-green-500">Ativo</Badge>
                      ) : (
                        <Badge variant="destructive">Inativo</Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {user.last_login ? formatDateTime(user.last_login) : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
